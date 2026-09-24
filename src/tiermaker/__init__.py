import ipaddress
import socket
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).parent
STATIC = ROOT / "static"
app = FastAPI(title="Tiermaker")
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/{asset}")
def static_asset(asset: str) -> FileResponse:
    if asset not in {"app.js", "style.css", "favicon.svg"}:
        raise HTTPException(404)
    return FileResponse(STATIC / asset)


@app.get("/api/image")
async def image(url: str = Query(min_length=8, max_length=2000)) -> Response:
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=15) as client:
            for _ in range(5):
                parsed = urlparse(url)
                if parsed.scheme not in {"http", "https"} or not parsed.hostname:
                    raise HTTPException(400, "Некорректная ссылка на изображение.")
                addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
                if any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
                    raise HTTPException(400, "Локальные адреса запрещены.")
                response = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if not response.is_redirect:
                    response.raise_for_status()
                    break
                url = str(response.next_request.url)
            else:
                raise HTTPException(422, "Слишком много перенаправлений.")
        content_type = response.headers.get("content-type", "")
        if not content_type.startswith("image/") or len(response.content) > 10_000_000:
            raise HTTPException(422, "Ссылка должна вести на изображение размером до 10 МБ.")
        return Response(response.content, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})
    except HTTPException:
        raise
    except (OSError, httpx.HTTPError) as exc:
        raise HTTPException(502, "Не удалось загрузить обложку.") from exc


def main() -> None:
    import uvicorn

    uvicorn.run("tiermaker:app", host="0.0.0.0", port=8000)
