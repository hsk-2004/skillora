"""MCP CLIENT side (requirement 2): how our agents and the ingestion flow call the MCP tool server (app/mcp_server.py).

Every call goes over the MCP protocol (streamable HTTP) with the shared key and the user id. If the MCP server cannot be reached,
the caller falls back to running the same code directly, so uploads and GitHub reads never break; the fallback is logged as an error.
"""
import asyncio
import base64
import concurrent.futures
import json
from typing import Any

from . import config
from .core import audit
from .parsers import InputRejected, fetch_github, parse_bytes


def _headers(uid: int | None) -> dict[str, str]:
    h = {"X-MCP-Key": config.MCP_SHARED_KEY} if config.MCP_SHARED_KEY else {}
    if uid is not None:
        h["X-User-Id"] = str(uid)  # set by our code, never by a model
    return h


async def acall(tool: str, args: dict[str, Any], uid: int | None = None, timeout: float = 90) -> dict[str, Any]:
    """Call one MCP tool and return its result as a dict. Raises on a connection or protocol failure."""
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    async with streamablehttp_client(config.MCP_URL, headers=_headers(uid), timeout=timeout) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            res = await session.call_tool(tool, args)
    if res.isError:
        raise RuntimeError(f"MCP tool {tool} failed: " + " ".join(getattr(c, "text", "") for c in res.content)[:200])
    if res.structuredContent:
        return dict(res.structuredContent)
    return json.loads(res.content[0].text)


def call(tool: str, args: dict[str, Any], uid: int | None = None) -> dict[str, Any]:
    """Blocking version, for code that is not async (run in a worker thread when an event loop is already running)."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(acall(tool, args, uid))
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        return ex.submit(lambda: asyncio.run(acall(tool, args, uid))).result()


def _fallback(uid: int | None, tool: str, err: Exception) -> None:
    audit.record(uid, "error", "MCP client", f"{tool} unreachable ({err}); ran the same code directly"[:250], status="error")


# ------------------------------------------------------------------ document parsing (used by the resume-upload step)
def _parsed(r: dict) -> tuple[str, str, list[str]]:
    if r.get("status") != "success":
        raise InputRejected(r.get("message") or "Could not read that file.")
    return r["source_type"], r["text"], r.get("urls", [])


async def parse_document_async(name: str, data: bytes, uid: int | None = None) -> tuple[str, str, list[str]]:
    if config.MCP_ENABLED:
        try:
            return _parsed(await acall("file_parser_mcp", {"file_name": name, "content_base64": base64.b64encode(data).decode()}, uid))
        except InputRejected:
            raise
        except Exception as e:  # noqa: BLE001 - server unreachable: same code, directly
            _fallback(uid, "file_parser_mcp", e)
    return parse_bytes(name, data)


# ------------------------------------------------------------------ GitHub reading (used by the GitHub-source step)
def read_github(ref: str, uid: int | None = None) -> tuple[str, str, str]:
    if config.MCP_ENABLED:
        try:
            r = call("github_crawler_mcp", {"repo": ref}, uid)
            if r.get("status") != "success":
                raise InputRejected(r.get("message") or "Could not read that repo.")
            return r["name"], r["text"], r["detail"]
        except InputRejected:
            raise
        except Exception as e:  # noqa: BLE001
            _fallback(uid, "github_crawler_mcp", e)
    return fetch_github(ref)
