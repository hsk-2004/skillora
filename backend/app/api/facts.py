from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import service
from app.api.deps import current_user, get_user_fact
from app.db import Fact, Source, User, get_db, next_seq

router = APIRouter(prefix="/api/facts", tags=["facts"])


class FactPatch(BaseModel):
    status: str | None = None
    text: str | None = None


class BulkIn(BaseModel):
    project: str | None = None
    status: str = "verified"
    scope: str = "pending"


class DeclareIn(BaseModel):
    skill: str


@router.get("")
def list_facts(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [service.fact_api(f) for f in service.all_facts(db, user.id, include_rejected=True)]


@router.patch("/{fid}")
def patch_fact(fid: str, b: FactPatch, db: Session = Depends(get_db), user: User = Depends(current_user)):
    f = get_user_fact(db, fid, user)
    f.auto = 0
    if b.status:
        if b.status not in {"pending", "verified", "rejected", "stale"}:
            raise HTTPException(422, "bad status")
        f.status = b.status
    if b.text is not None:
        f.text = b.text.strip()
        f.status = "verified"
    db.commit()
    return service.fact_api(f)


@router.post("/bulk")
def bulk(b: BulkIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Confirm every PENDING fact in one group - one click instead of 40."""
    if b.status not in {"verified", "rejected"}:
        raise HTTPException(422, "bad status")
    q = db.query(Fact).filter(Fact.user_id == user.id)
    q = q.filter(Fact.status == "pending") if b.scope == "pending" else q.filter(Fact.status.in_(["pending", "verified", "stale"]), Fact.declared == 0)
    if b.project:
        q = q.filter(Fact.project == b.project)
    n = q.update({Fact.status: b.status, Fact.auto: 0}, synchronize_session=False)
    db.commit()
    return {"updated": n}


@router.delete("/{fid}")
def delete_fact(fid: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    f = get_user_fact(db, fid, user)
    db.delete(f)
    db.commit()
    return {"deleted": fid}


class FactCreate(BaseModel):
    project: str
    category: str = "experience"
    text: str
    span: str = ""
    status: str = "verified"


@router.post("")
def create_fact(b: FactCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    f = Fact(
        user_id=user.id,
        seq=next_seq(db, user.id),
        source_id=None,
        text=b.text.strip(),
        span=b.span.strip(),
        project=b.project.strip(),
        category=b.category,
        status=b.status,
        declared=0,
    )
    db.add(f)
    db.commit()
    return service.fact_api(f)


class ProjectActionIn(BaseModel):
    project: str


@router.post("/project/verify")
def verify_project_all(b: ProjectActionIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Mark all facts for a project as verified."""
    target = b.project.strip().lower()
    facts = service.all_facts(db, user.id, include_rejected=True)
    count = 0
    for f in facts:
        p_name = (f.project or "").lower()
        s_name = (f.source.name if f.source else "").lower()
        if target in p_name or target in s_name or (s_name.split("/")[-1] == target):
            f.status = "verified"
            f.auto = 0
            count += 1
    db.commit()
    return {"updated": count, "project": b.project, "status": "verified"}


@router.post("/project/unverify")
def unverify_project_all(b: ProjectActionIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Mark all facts for a project as pending."""
    target = b.project.strip().lower()
    facts = service.all_facts(db, user.id, include_rejected=True)
    count = 0
    for f in facts:
        p_name = (f.project or "").lower()
        s_name = (f.source.name if f.source else "").lower()
        if target in p_name or target in s_name or (s_name.split("/")[-1] == target):
            f.status = "pending"
            f.auto = 0
            count += 1
    db.commit()
    return {"updated": count, "project": b.project, "status": "pending"}


@router.delete("/project/{project_name:path}")  # :path so names containing "/" (e.g. "AI/ML Intern") still route
def delete_project_facts(project_name: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Delete a project and all associated facts and sources."""
    target = project_name.strip().lower()
    # Check sources
    sources = db.query(Source).filter(Source.user_id == user.id).all()
    deleted_sources = 0
    for s in sources:
        s_base = s.name.split("/")[-1].lower()
        if target == s.name.lower() or target == s_base:  # exact match only: a substring match could delete unrelated sources
            db.delete(s)
            deleted_sources += 1

    # Check any leftover facts with matching project name
    facts = db.query(Fact).filter(Fact.user_id == user.id).all()
    deleted_facts = 0
    for f in facts:
        p_base = (f.project or "").split("/")[-1].lower()
        if target == (f.project or "").lower() or target == p_base:  # exact match only: "Map" must not delete "Mappers"
            db.delete(f)
            deleted_facts += 1

    db.commit()
    return {"ok": True, "project": project_name, "deleted_sources": deleted_sources, "deleted_facts": deleted_facts}


@router.post("/declare")
def declare(b: DeclareIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Self-declared skill: counts in the score at lower weight, never used to write a project bullet."""
    f = Fact(
        user_id=user.id,
        seq=next_seq(db, user.id),
        source_id=None,
        text=b.skill.strip(),
        span="",
        project="Skills",
        category="skill",
        status="verified",
        declared=1,
    )
    db.add(f)
    db.commit()
    return service.fact_api(f)

