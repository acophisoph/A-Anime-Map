# anime-atlas

Production-ready monorepo for a static GitHub Pages anime/media + people atlas with durable batched AniList ingestion.

## Quick start

```bash
npm ci
npm run ingest:batched
npm run build:artifacts
npm run sanity:artifacts
npm run sync:data
npm run dev
```

## Monorepo layout

- `app/`: Vite + React + TS static atlas client
- `scripts/`: SQLite migrations, batched ingest, artifact build and sanity checks
- `data/`: committed generated artifacts consumed by the app
- `docs/`: architecture and data contracts
- `.github/workflows/`: ingest and deploy workflows

## Ingest model

- Layer A (`scripts/.cache/anime-atlas.sqlite`): normalized source of truth with durable batch checkpoints.
- Layer B (`data/`): always-valid static artifacts built incrementally from SQLite, including partial completeness flags.

Batches are represented by `batches.scope_key` entries (`ANIME:page:N`, `MANGA:page:N`, `MEDIA_STAFF:ID`, `MEDIA_CHARACTERS:ID`) and are resumed across runs.

## Artifact encoding

To support environments where binary artifact diffs are not supported, graph and point artifacts are emitted as JSON (`points.json`, `graph_*.json`).
