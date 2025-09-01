# Contributing to ConeEditor

## Getting started

- Install Node (>=18.17) and pnpm (>=8)
- Install Python 3.10/3.11
- `pnpm install`

## Development

- Run renderer + Electron: `pnpm dev`
- Run Python service: create venv and `uvicorn python.server:app --reload`

## Code style

- TypeScript: ESLint + Prettier
- Python: black + isort + flake8

## CI

GitHub Actions checks formatting, lint, typecheck, tests, and build.
