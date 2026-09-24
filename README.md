# Tiermaker

Локальный редактор больших тир-листов. Импортирует сохранённые HTML-страницы Backloggd, CSV и собственные JSON-сессии; экспортирует результат в PNG.

```bash
uv sync
uv run app
```

Откройте <http://localhost:8000>.

```bash
docker build -t tiermaker .
docker run --rm -p 8000:8000 tiermaker
```
