# Architecture

Two-layer pipeline:

1. **Normalize layer**: AniList GraphQL -> SQLite tables (`media`, `people`, `credits`, relations, characters). Batches are independent and atomic.
2. **Artifact layer**: SQLite -> immutable-ish static files in `data/` for GitHub Pages.

Frontend is static-only and loads local files from `app/public/data`.

Progressive loading order: manifest -> points -> indices -> metadata chunks -> graph binaries.
