# ConeEditor Monorepo

Electron + React (Vite + TS) renderer and Python FastAPI service.

## Requirements

- Node >= 18.17
- pnpm >= 8
- Python 3.10/3.11

## Install

```bash
pnpm install
```

## Dev

- Start renderer and Electron:

```bash
pnpm dev
```

- Start Python FastAPI stub:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r python/requirements.txt
uvicorn python.server:app --reload
```

## Scripts

- `pnpm lint` / `pnpm format` / `pnpm typecheck` / `pnpm build`

## CI

GitHub Actions runs Node lint/typecheck/build and Python lint/tests.
