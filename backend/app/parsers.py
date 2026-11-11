"""Document parsing + input safety checks (Phase 1, steps 1-2: add sources, ingest & chunk)."""
import hashlib
from concurrent.futures import ThreadPoolExecutor
import io
import re

import httpx

from .config import GITHUB_TOKEN, MAX_UPLOAD_MB
from .core import audit as _audit

ALLOWED = {"pdf", "docx", "pptx", "txt", "md", "zip"}

PII_RE = {
    "aadhaar": re.compile(r"\b\d{4}\s\d{4}\s\d{4}\b"),
    "card": re.compile(r"\b(?:\d[ -]?){13,16}\b"),
}
INJECTION_RE = re.compile(
    r"(ignore (all )?(previous|prior|above|system|other) (instructions|prompts|rules|constraints|directives)|"
    r"disregard (all |the )?(system|above|prior|previous|rules|guardrails|constraints|evidence)|"
    r"you are now (an? )?(unrestricted|jailbroken|developer mode|dan|evaluator|assistant)|"
    r"reveal (your |all |the )?(system |developer |internal )?(prompt|instructions)|"
    r"system override|bypass (all )?(guardrails|safety|verification|checks)|"
    r"override (system |all )?(instructions|rules|safety|guardrails)|"
    r"grant (root|admin|full) (access|privilege|permissions)|"
    r"output:\s*[\"']?candidate is a 100% perfect match|"
    r"<\s*script)",
    re.I,
)


class InputRejected(ValueError):
    pass


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf8", "ignore")).hexdigest()


def check_input(text: str, *, kind: str = "source") -> list[str]:
    """Reject prompt-injection; return non-blocking warnings (PII)."""
    match = INJECTION_RE.search(text)
    if match:
        matched_str = match.group(0)[:60]
        raise InputRejected(
            f"Input rejected by SkillOra Safety Guardrails: prompt injection pattern detected ('{matched_str}'). "
            "The safety engine prevented adversarial instructions from reaching the analysis agents."
        )
    return [f"possible {k} number found" for k, rx in PII_RE.items() if rx.search(text)]


def validate_resume_document(text: str, filename: str = "") -> None:
    """Validate that the uploaded document is a legitimate candidate resume, NOT a subject PPT, lecture presentation, or non-resume document."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    lower_text = text.lower()

    # 1. Direct presentation format rejection
    if ext in ("pptx", "ppt", "key", "pps"):
        raise InputRejected(
            f"Input rejected by SkillOra Relevance Guardrails: Presentation slide deck (.{ext}) detected ('{filename}'). "
            "SkillOra requires a professional resume or curriculum vitae document (PDF or DOCX), not presentation slides. "
            "Slide presentations are quarantined to preserve evidence ledger integrity."
        )

    # 2. Slide deck structure markers
    slide_matches = re.findall(r"(?:^|\n)\s*(?:#\s*)?slide\s+\d+\b", lower_text)
    is_slide_deck = len(slide_matches) >= 2

    # 3. Academic Course / Lecture / Syllabus markers
    academic_patterns = [
        (r"\b(lecture\s+\d+|module\s+\d+|unit\s+\d+|chapter\s+\d+)\b", "Academic Lecture / Unit"),
        (r"\b(learning\s+objectives?|course\s+objectives?|course\s+outline|course\s+syllabus|syllabus)\b", "Course Curriculum / Syllabus"),
        (r"\b(textbook[s]?:|reference\s+books?:|recommended\s+reading:)\b", "Textbook Reference"),
        (r"\b(instructor[s]?:|prof\.\s+[a-z]+|professor\s+[a-z]+|teaching\s+assistant|office\s+hours:)\b", "Faculty / Instructor Marker"),
        (r"\b(grading\s+policy|grading\s+rubric|attendance\s+policy|midterm\s+exam|final\s+exam|homework\s+assignment)\b", "Coursework / Examination Policy"),
        (r"\b(table\s+of\s+contents|agenda:|presentation\s+outline|topics\s+covered|key\s+takeaways)\b", "Presentation Agenda"),
        (r"\b(any\s+questions\s*\?|questions\s*&\s*answers|thank\s+you\s+for\s+listening|thank\s+you!)\b", "Slide Closing Marker"),
    ]
    matched_markers = [desc for pat, desc in academic_patterns if re.search(pat, lower_text)]
    marker_summary = ", ".join(matched_markers[:3])

    # 4. Resume Core Anchors
    has_email = bool(re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text))
    has_phone = bool(re.search(r"(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{2,5}[-.\s]?\d{2,5}", text))

    resume_sections = [
        bool(re.search(r"\b(experience|work\s+experience|professional\s+experience|employment\s+history|internships?)\b", lower_text)),
        bool(re.search(r"\b(education|academic\s+background|b\.?\s?tech|b\.?\s?e\b|b\.?\s?s\b|bachelor|m\.?\s?tech|m\.?\s?s\b|master|ph\.?\s?d|degree|university|college|cgpa|gpa)\b", lower_text)),
        bool(re.search(r"\b(skills|technical\s+skills|core\s+competencies|technologies|proficiencies)\b", lower_text)),
        bool(re.search(r"\b(projects|personal\s+projects|academic\s+projects|technical\s+projects)\b", lower_text)),
    ]
    section_score = sum(resume_sections)

    # Extract subject title if present
    topic = ""
    for l in [line.strip() for line in text.splitlines() if line.strip()][:5]:
        clean = re.sub(r"^(?:#\s*)?(?:slide\s*\d*[:\s-]*|lecture\s*\d*[:\s-]*)?", "", l, flags=re.I).strip()
        if 4 < len(clean) < 60 and not re.search(r"agenda|outline|syllabus", clean, re.I):
            topic = clean
            break
    topic_str = f" ('{topic}')" if topic else ""

    if is_slide_deck and matched_markers:
        raise InputRejected(
            f"Input rejected by SkillOra Relevance Guardrails: The uploaded file was identified as an academic subject presentation / lecture slide deck{topic_str}, not a candidate resume. "
            f"Detected markers: {marker_summary}. Ingestion blocked to preserve evidence ledger integrity."
        )
    if len(matched_markers) >= 2 and (section_score <= 1 or not has_email):
        raise InputRejected(
            f"Input rejected by SkillOra Relevance Guardrails: Document content detected as academic coursework / lecture material{topic_str}, not a candidate resume. "
            f"Detected markers: {marker_summary}. Ingestion blocked to preserve evidence ledger integrity."
        )
    if is_slide_deck and section_score <= 1:
        raise InputRejected(
            f"Input rejected by SkillOra Relevance Guardrails: Presentation slide deck structure detected{topic_str} with zero candidate work experience. Ingestion quarantined."
        )
    if section_score == 0 and not has_email and not has_phone:
        raise InputRejected(
            "Input rejected by SkillOra Relevance Guardrails: Document relevance check failed. "
            "The uploaded document does not contain recognizable candidate resume sections (Experience, Education, Skills, Projects). "
            "Ingestion quarantined."
        )


def parse_bytes(name: str, data: bytes) -> tuple[str, str, list[str]]:
    """Return (source_type, text, hyperlink_urls). Hyperlinks matter: resumes often hide the URL behind clickable text."""
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise InputRejected(f"File larger than {MAX_UPLOAD_MB} MB.")
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else "txt"
    if ext not in ALLOWED:
        raise InputRejected(f"Unsupported file type .{ext}. Allowed: PDF, DOCX, PPTX, TXT, MD.")
    if ext == "pdf":
        import pdfplumber

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            text = "\n".join((p.extract_text() or "") for p in pdf.pages)
            urls = [h["uri"] for p in pdf.pages for h in (p.hyperlinks or []) if h.get("uri")]
        return "pdf", text, urls
    if ext == "docx":
        import docx

        d = docx.Document(io.BytesIO(data))
        parts = [p.text for p in d.paragraphs]
        for t in d.tables:
            for row in t.rows:
                parts.append(" | ".join(c.text.strip() for c in row.cells))
        urls = [r.target_ref for r in d.part.rels.values() if "hyperlink" in r.reltype and getattr(r, "is_external", False)]
        return "docx", "\n".join(parts), urls
    if ext == "pptx":
        from pptx import Presentation

        prs = Presentation(io.BytesIO(data))
        parts = []
        for i, slide in enumerate(prs.slides, 1):
            parts.append(f"# Slide {i}")
            for sh in slide.shapes:
                if sh.has_text_frame:
                    parts.extend(p.text for p in sh.text_frame.paragraphs)
        return "pptx", "\n".join(parts), []
    if ext == "zip":
        import zipfile
        parts = []
        urls = []
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                manifest_names = {"requirements.txt", "pyproject.toml", "package.json", "dockerfile", "docker-compose.yml", "cargo.toml", "go.mod"}
                for n in z.namelist():
                    lower_n = n.lower().split("/")[-1]
                    if any(ign in n for ign in ["node_modules/", ".git/", "__pycache__/", "venv/", ".venv/"]):
                        continue
                    if lower_n.startswith("readme") and (lower_n.endswith(".md") or lower_n.endswith(".txt")):
                        try:
                            content = z.read(n).decode("utf8", "ignore")
                            parts.append(f"# {n}\n" + content[:6000])
                        except Exception:
                            pass
                    elif lower_n in manifest_names:
                        try:
                            content = z.read(n).decode("utf8", "ignore")
                            parts.append(f"Manifest {n}:\n" + re.sub(r"\s+", " ", content[:1500]))
                        except Exception:
                            pass
        except Exception as e:
            raise InputRejected(f"Could not parse ZIP file: {e}")
        return "code", "\n\n".join(parts), urls
    return "note", data.decode("utf8", "ignore"), []


def parse_code_folder(folder_path: str) -> tuple[str, str, str]:
    """Parses a local code directory looking for READMEs and manifest files (from original SkillOra code_folder parser)."""
    import os
    if not os.path.exists(folder_path):
        raise InputRejected(f"Folder not found: {folder_path}")
    name = os.path.basename(os.path.normpath(folder_path))
    parts = [f"# {name}"]
    manifest_names = {"requirements.txt", "pyproject.toml", "package.json", "dockerfile", "docker-compose.yml", "cargo.toml", "go.mod"}
    count = 0
    for root, dirs, files in os.walk(folder_path):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", "venv", "__pycache__", ".git")]
        for file in files:
            count += 1
            lower_f = file.lower()
            rel_path = os.path.relpath(os.path.join(root, file), folder_path)
            if lower_f.startswith("readme") and (lower_f.endswith(".md") or lower_f.endswith(".txt")):
                try:
                    with open(os.path.join(root, file), "r", encoding="utf-8", errors="ignore") as f:
                        parts.append(f"# {rel_path}\n" + f.read()[:6000])
                except Exception:
                    pass
            elif lower_f in manifest_names:
                try:
                    with open(os.path.join(root, file), "r", encoding="utf-8", errors="ignore") as f:
                        parts.append(f"Manifest {rel_path}:\n" + re.sub(r"\s+", " ", f.read()[:1500]))
                except Exception:
                    pass
    detail = f"Local code folder · {count} files"
    return name, "\n\n".join(parts), detail


# ---------------------------------------------------------------- GitHub (trimmed)
GH = "https://api.github.com"
MANIFESTS = ["requirements.txt", "pyproject.toml", "package.json", "Dockerfile", "docker-compose.yml", "go.mod", "pom.xml", "Cargo.toml"]


def parse_repo_ref(ref: str) -> tuple[str, str]:
    m = re.search(r"(?:github\.com/)?([\w.-]+)/([\w.-]+?)(?:\.git)?/?$", ref.strip())
    if not m:
        raise InputRejected("Could not read that GitHub repo. Use owner/repo or the full URL.")
    return m.group(1), m.group(2)


def _fetch_github(ref: str) -> tuple[str, str, str]:
    """High-signal slice only: description, languages, README, manifest files. Returns (name, text, detail)."""
    owner, repo = parse_repo_ref(ref)
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    raw = {**headers, "Accept": "application/vnd.github.raw"}
    with httpx.Client(timeout=20, headers=headers, follow_redirects=True) as c:
        r = c.get(f"{GH}/repos/{owner}/{repo}")
        if r.status_code == 404:
            raise InputRejected("Repo not found (is it public?).")
        if r.status_code == 403:
            raise InputRejected("GitHub rate limit hit. Add a GITHUB_TOKEN to the root .env file and restart the backend.")
        r.raise_for_status()
        info = r.json()
        # languages + README + every manifest in parallel (one round-trip of latency instead of ~10)
        with ThreadPoolExecutor(max_workers=10) as ex:
            f_lang = ex.submit(c.get, f"{GH}/repos/{owner}/{repo}/languages")
            f_read = ex.submit(c.get, f"{GH}/repos/{owner}/{repo}/readme", headers=raw)
            f_man = {m: ex.submit(c.get, f"{GH}/repos/{owner}/{repo}/contents/{m}", headers=raw) for m in MANIFESTS}
            langs = f_lang.result().json()
            readme = f_read.result()
            manifests = {m: f.result() for m, f in f_man.items()}
        lines = [f"# {repo}", info.get("description") or ""]
        if langs:
            lines.append("Languages: " + ", ".join(list(langs)[:6]))
        if info.get("topics"):
            lines.append("Topics: " + ", ".join(info["topics"]))
        if readme.status_code == 200:
            lines.append(readme.text[:6000])
        for m, f in manifests.items():
            if f.status_code == 200:
                lines.append(f"{m} dependencies: " + re.sub(r"\s+", " ", f.text[:1200]))
    detail = f"GitHub repo · {info.get('stargazers_count', 0)}★ · {next(iter(langs), 'n/a')}"
    return f"{owner}/{repo}", "\n".join(lines), detail


# ---------------------------------------------------------------- chunking
def chunk(text: str, size: int = 1500) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n|\n(?=#)", text) if p.strip()]
    out, cur = [], ""
    for p in paras:
        if len(cur) + len(p) > size and cur:
            out.append(cur)
            cur = ""
        cur += p + "\n"
    if cur:
        out.append(cur)
    return out


# ---------------------------------------------------------------- GitHub links found inside a document
GH_LINK_RE = re.compile(r"github\.com/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))(?:/([A-Za-z0-9._-]+))?", re.I)
GH_RESERVED = {"features", "sponsors", "login", "join", "about", "pricing", "topics", "marketplace", "settings", "orgs", "apps", "enterprise", "collections", "explore", "notifications", "pulls", "issues"}


def extract_github_links(text: str, urls: list[str] | None = None) -> dict:
    """{'profiles': ['hsk-2004'], 'repos': ['owner/repo']} from visible text and hidden hyperlinks."""
    profiles, repos = [], []
    for blob in [text] + (urls or []):
        for owner, repo in GH_LINK_RE.findall(blob):
            if owner.lower() in GH_RESERVED:
                continue
            repo = re.sub(r"(\.git)?[.,;:)]*$", "", repo or "")
            if repo and repo.lower() not in {"tree", "blob", "issues", "pulls", "wiki", "actions"}:
                key = f"{owner}/{repo}"
                if key.lower() not in {r.lower() for r in repos}:
                    repos.append(key)
            elif owner.lower() not in {p.lower() for p in profiles}:
                profiles.append(owner)
    # a profile that also has repo links is still worth listing; keep both
    return {"profiles": profiles[:3], "repos": repos[:10]}


def _list_user_repos(username: str, limit: int = 100) -> list[dict]:
    """Public repos (including forks, with is_fork flag), matching GitHub's profile repository count exactly."""
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    # Query user profile first to get the exact public_repos count as shown on GitHub
    u_resp = httpx.get(f"{GH}/users/{username}", headers=headers, timeout=25)
    _audit.record(None, "tool", "Outbound · GitHub API", f"GET /users/{username} -> HTTP {u_resp.status_code}", status="ok" if u_resp.status_code < 400 else "error")
    if u_resp.status_code == 404:
        raise InputRejected(f"GitHub user '{username}' not found.")
    if u_resp.status_code == 403:
        raise InputRejected("GitHub rate limit hit. Add a GITHUB_TOKEN to the root .env file and restart the backend.")
    u_resp.raise_for_status()
    user_info = u_resp.json()
    total_public = user_info.get("public_repos", 0)

    # Fetch all pages up to total_public (or at least limit)
    effective_limit = max(limit, total_public)
    page = 1
    repos = []
    while len(repos) < effective_limit:
        per_page = min(100, effective_limit - len(repos))
        r = httpx.get(
            f"{GH}/users/{username}/repos",
            params={"per_page": per_page, "page": page, "sort": "pushed", "type": "owner"},
            headers=headers,
            timeout=25,
        )
        if r.status_code == 404:
            raise InputRejected(f"GitHub user '{username}' not found.")
        if r.status_code == 403:
            raise InputRejected("GitHub rate limit hit. Add a GITHUB_TOKEN to the root .env file and restart the backend.")
        r.raise_for_status()
        items = r.json()
        if not items or not isinstance(items, list):
            break
        for x in items:
            repos.append({
                "repo": x["full_name"],
                "description": x.get("description") or "",
                "language": x.get("language") or "",
                "stars": x.get("stargazers_count", 0),
                "pushed": (x.get("pushed_at") or "")[:10],
                "is_fork": bool(x.get("fork")),
                "forks_count": x.get("forks_count", 0),
                "html_url": x.get("html_url", f"https://github.com/{x['full_name']}"),
            })
        if len(items) < per_page:
            break
        page += 1

    return repos


def _retry_github(fn, *args):
    """GitHub is occasionally slow from some networks: retry once, then explain instead of crashing."""
    for attempt in (1, 2):
        try:
            return fn(*args)
        except httpx.TransportError:  # timeouts, connection resets, DNS
            if attempt == 2:
                raise InputRejected("Could not reach GitHub (timed out). Check your internet connection and try again.") from None


def fetch_github(ref: str) -> tuple[str, str, str]:
    return _retry_github(_fetch_github, ref)


def list_user_repos(username: str, limit: int = 100) -> list[dict]:
    return _retry_github(_list_user_repos, username, limit)


def extract_resume_entities(text: str, urls: list[str] | None = None) -> dict:
    """Extract candidate details from any resume text: Name, Email, Phone, Location, Degree, University, CGPA, Years, Skills, Experience, Projects, GitHub."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Collect contact header block (lines before the first major section heading)
    header_lines = []
    for l in lines[:15]:
        if re.match(
            r"^(?:Education|Experience|Skills|Summary|Projects|Technical Skills|Work Experience|Professional Experience|Objective|Profile)\b",
            l,
            re.I,
        ):
            break
        header_lines.append(l)
    header = "\n".join(header_lines)

    # 1. Candidate Name: first 1-4 lines not containing keywords/symbols/contacts
    name = ""
    for l in (header_lines or lines)[:5]:
        clean = re.sub(r"[^a-zA-Z\s]", "", l).strip()
        words = clean.split()
        if 2 <= len(words) <= 4 and not re.search(
            r"resume|curriculum|vitae|page|engineer|developer|education|experience|skills|contact|profile|summary|github|http",
            l,
            re.I,
        ):
            name = clean
            break

    # 2. Email (RFC-compliant regex)
    email_m = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", header or text)
    email = email_m.group(0) if email_m else ""

    # 3. Phone (International formats: +1, +44, +91, (XXX), etc.)
    phone_m = re.search(r"(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{2,5}[-.\s]?\d{2,5}(?:[-.\s]?\d{2,5})?\b", header or text)
    phone = phone_m.group(0).strip() if phone_m else ""

    # 4. Location: Extract from header block without hardcoded fallbacks
    location = ""
    m_loc = re.search(r"(?:Location|Address|Based in|City|Residence)[:\s]*([A-Za-z\s]+(?:,\s*[A-Za-z\s]+){1,2})", header, re.I)
    if m_loc:
        location = m_loc.group(1).strip()
    else:
        for cand in re.findall(r"\b([A-Z][a-zA-Z\s]+),\s*([A-Z]{2}\b|[A-Z][a-zA-Z]+)\b", header):
            combo = f"{cand[0].strip()}, {cand[1].strip()}"
            if not re.search(r"Python|Java|SQL|React|Docker|Git|Resume|Education|Experience", combo, re.I):
                location = combo
                break

    # 5. Education (Degree, University, CGPA, Years)
    degree = ""
    for l in lines:
        if re.search(r"\b(b\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|b\.?\s?s\b|bachelor|m\.?\s?tech|m\.?\s?s\b|m\.?\s?sc|master|ph\.?\s?d|doctorate|diploma|mba|bba|mca|bca)\b", l, re.I):
            d = re.sub(r"((?:19|20)\d{2})\s*[\u2010-\u2015\u2212\ufffd\-\s/to]+\s*((?:19|20)\d{2}|[Pp]resent|[Cc]urrent)", "", l)
            d = re.sub(r"[\u2010-\u2015\u2212\ufffd\-\s]*(?:19|20)\d{2}\s*$", "", d)
            d = re.sub(r"[\ufffd\u2022\u2013\u2014|]", " ", d)
            d = re.sub(r"\b(?:GPA|CGPA|Grade|Score)[\s:]*[0-9./\s]+", "", d, flags=re.I)
            d = re.sub(r"\s+", " ", d).strip()
            if d:
                degree = d
                break

    univ = ""
    univ_m = re.search(r"([A-Z][a-zA-Z\s&.]+(?:University|College|Institute|Academy|School|Polytechnic|Campus|Faculty|ETH\s+Zurich|MIT|IIT)[a-zA-Z\s]*)", text)
    if univ_m:
        u = univ_m.group(1).strip()
        u = re.sub(r"^(?:education|academic background|academic qualifications)\s*", "", u, flags=re.I).strip()
        u = re.split(r"\b(?:CGPA|GPA|Grade|Score|19\d{2}|20\d{2})\b", u, flags=re.I)[0].strip()
        univ = re.sub(r"\s+", " ", u).strip()

    cgpa = ""
    cgpa_m = re.search(r"(?:CGPA|GPA|Grade|Score|Percentage|Marks?)[\s:]*([0-9]+(?:\.[0-9]+)?(?:\s*/\s*[0-9]+(?:\.[0-9]+)?)?%?)", text, re.I)
    if cgpa_m:
        val = cgpa_m.group(1).strip()
        try:
            cgpa = f"{val} / 10.0" if "/" not in val and float(val) <= 10.0 and not val.endswith("%") else val
        except Exception:
            cgpa = val

    years = ""
    years_m = re.search(r"((?:19|20)\d{2})\s*[\u2010-\u2015\u2212\ufffd\-\s/to]+\s*((?:19|20)\d{2}|[Pp]resent|[Cc]urrent)", text, re.I)
    if years_m:
        years = f"{years_m.group(1)} - {years_m.group(2)}"

    # 6. Skills (Section parsing + Vocabulary match)
    skills = []
    tech_sec = re.search(
        r"(?:Technical\s+Skills|Skills|Competencies|Core\s+Competencies|Technologies|Tools\s*&\s*Frameworks|Proficiencies|Expertise)([\s\S]*?)(?:Projects|Experience|Work|Education|$)",
        text,
        re.I,
    )
    if tech_sec:
        for line in tech_sec.group(1).splitlines():
            line = re.sub(r"^[A-Za-z\s&]+:\s*", "", line)
            for token in re.split(r"[,|•·▪\n/]", line):
                token = token.strip()
                if token and 1 < len(token) < 32 and not token.lower().startswith("http"):
                    if token not in skills:
                        skills.append(token)

    from .vocab import find_skills, pretty
    for sk in find_skills(text):
        label = pretty(sk)
        if label not in skills:
            skills.append(label)

    # 7. Experience
    exp_list = []
    exp_sec = re.search(
        r"(?:Experience|Work\s+Experience|Professional\s+Experience|Employment\s+History|Internships)([\s\S]*?)(?:Projects|Education|Achievements|Certifications|Skills|$)",
        text,
        re.I,
    )
    if exp_sec:
        exp_lines = [l.strip() for l in exp_sec.group(1).splitlines() if l.strip()]
        i = 0
        while i < len(exp_lines):
            l = exp_lines[i]
            d_m = re.search(
                r"([A-Za-z]{3,9}\s+(?:19|20)\d{2}|(?:19|20)\d{2})\s*[\u2010-\u2015\u2212\ufffd\-\s/to]+\s*([A-Za-z]{3,9}\s+(?:19|20)\d{2}|(?:19|20)\d{2}|[Pp]resent|[Cc]urrent)",
                l,
            )
            if d_m:
                company = l[:d_m.start()].strip() or (exp_lines[i - 1] if i > 0 else "Organization")
                company = re.sub(r"^[-*•▪\s]+", "", company).strip()
                period = f"{d_m.group(1)} - {d_m.group(2)}"
                role = exp_lines[i + 1] if i + 1 < len(exp_lines) else "Role"
                role = re.sub(r"^[-*•▪\s]+", "", role).strip()
                exp_list.append({"company": company, "period": period, "role": role})
                i += 2
                continue
            i += 1

    # 8. GitHub Profile
    gh = extract_github_links(text, urls)
    github_user = gh["profiles"][0] if gh.get("profiles") else ""

    edu_summary = f"{degree} · {univ} ({years})" if degree and univ else (degree or univ)

    return {
        "name": name,
        "email": email,
        "phone": phone,
        "location": location,
        "degree": degree,
        "university": univ,
        "cgpa": cgpa,
        "grad_years": years,
        "education_summary": edu_summary,
        "skills": skills,
        "experience": exp_list,
        "github_user": github_user,
    }
