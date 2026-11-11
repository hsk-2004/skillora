from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import activity, service
from app.api.deps import current_user
from app.db import Source, User, get_db
from app.parsers import (
    check_input,
    extract_github_links,
    extract_resume_entities,
    fetch_github,
    list_user_repos,
    parse_bytes,
    parse_code_folder,
    validate_resume_document,
)

router = APIRouter(prefix="/api", tags=["sources"])


class GithubIn(BaseModel):
    repo: str


class NoteIn(BaseModel):
    name: str = "Note"
    text: str


class FolderIn(BaseModel):
    folder_path: str


def _ingested(db: Session, src: Source, info: dict):
    return {"source": service.source_view(src), **info}


@router.get("/sources")
def list_sources(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [service.source_view(s) for s in db.query(Source).filter(Source.user_id == user.id).order_by(Source.updated.desc()).all()]


@router.post("/sources/github")
def add_github(b: GithubIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    with activity.step(user.id, "GitHub reader", "GitHub REST API · README + manifests") as s:
        name, text, detail = fetch_github(b.repo)
        s["note"] = name
    src, info = service.ingest_text(db, user.id, name=name, stype="github", text=text, uri=b.repo, detail=detail)
    return _ingested(db, src, info)


@router.post("/sources/upload")
async def upload(
    file: UploadFile = File(...),
    source_id: int | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    data = await file.read()
    with activity.step(user.id, "Document parser", "pdfplumber · python-docx · python-pptx · zip") as s:
        stype, text, urls = parse_bytes(file.filename or "upload.txt", data)
        s["note"] = f"{file.filename} · {len(text):,} characters"

    # SkillOra Safety & Relevance Guardrails
    check_input(text, kind="source")
    validate_resume_document(text, file.filename or "upload.txt")
    detail = f"{stype.upper()} · {len(data) // 1024} KB"
    name = file.filename or "upload"
    if source_id:
        old = db.get(Source, source_id)
        if old and old.user_id == user.id and old.type != "github":
            name, stype = old.name, old.type
    src, info = service.ingest_text(db, user.id, name=name, stype=stype, text=text, detail=detail)
    info["github"] = extract_github_links(text, urls)
    extracted = {}
    is_sample = (file.filename or "").lower().startswith(("sample_", "adversarial_"))  # built-in demo files belong to someone else
    if stype in ("pdf", "docx", "pptx", "note") and not is_sample:  # profile auto-fill only from the user's own resume
        extracted = extract_resume_entities(text, urls)
        if extracted.get("name"):
            user.name = extracted["name"]
        if extracted.get("phone") and hasattr(user, "phone"):
            user.phone = extracted["phone"]
        if extracted.get("location"):
            user.location = extracted["location"]
        if extracted.get("education_summary"):
            user.education = extracted["education_summary"]
        if extracted.get("github_user"):
            user.links = f"github.com/{extracted['github_user']}"
        db.add(user)
        db.commit()
    elif not user.links and info["github"]["profiles"]:
        user.links = "github.com/" + info["github"]["profiles"][0]
        db.add(user)
        db.commit()

    res = _ingested(db, src, info)
    res["extracted"] = extracted
    return res


@router.post("/sources/folder")
def add_code_folder(b: FolderIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    with activity.step(user.id, "Code folder parser", "Local repository inspector") as s:
        name, text, detail = parse_code_folder(b.folder_path)
        s["note"] = name
    src, info = service.ingest_text(db, user.id, name=name, stype="code", text=text, uri=b.folder_path, detail=detail)
    return _ingested(db, src, info)


@router.get("/github/repos")
def github_repos(user_name: str, limit: int = 100, db: Session = Depends(get_db), user: User = Depends(current_user)):
    have = {s.name.lower() for s in db.query(Source).filter(Source.user_id == user.id, Source.type == "github").all()}
    return [{**r, "added": r["repo"].lower() in have} for r in list_user_repos(user_name.strip(), limit=limit)]


@router.post("/sources/note")
def add_note(b: NoteIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    src, info = service.ingest_text(db, user.id, name=b.name, stype="note", text=b.text, detail="Free-text note")
    return _ingested(db, src, info)


@router.post("/sources/{sid}/resync")
def resync(sid: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    s = db.get(Source, sid)
    if not s or s.user_id != user.id or s.type != "github":
        raise HTTPException(400, "Only GitHub sources can be re-synced from here; re-upload the file instead.")
    name, text, detail = fetch_github(s.uri or s.name)
    src, info = service.ingest_text(db, user.id, name=name, stype="github", text=text, uri=s.uri, detail=detail)
    return _ingested(db, src, info)


@router.delete("/sources/{sid}")
def delete_source(sid: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    s = db.get(Source, sid)
    cleared = 0
    if s and s.user_id == user.id:
        cleared = _clear_extraction_cache(db, s)
        db.delete(s)
        db.commit()
    return {"ok": True, "cache_cleared": cleared}


def _clear_extraction_cache(db: Session, s: Source) -> int:
    """Forget the cached extraction for this exact file, so uploading it again is re-analysed from scratch instead of
    returning the old result instantly ("this exact file was read before")."""
    from app.config import MAX_FACTS_GITHUB, MAX_FACTS_PER_SOURCE
    from app.db import LLMCache
    from app.parsers import sha

    keys = {sha(f"extract2|{lim}|{s.name}|{s.text}") for lim in (MAX_FACTS_PER_SOURCE, MAX_FACTS_GITHUB)}
    n = db.query(LLMCache).filter(LLMCache.key.in_(keys)).delete(synchronize_session=False)
    return n
