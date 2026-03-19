# AniList data contract

Implemented query strings:

- `QueryMediaList($page,$perPage,$type,$sort)` for ANIME/MANGA discovery using `POPULARITY_DESC`.
- `QueryMediaStaff($id,$page,$perPage)` for complete paginated staff ingest.
- `QueryMediaCharacters($id,$page,$perPage)` for complete paginated characters + Japanese voice actors.

Mapping summary:

- media list -> `media`, `media_relations`, seeds `MEDIA_STAFF` / `MEDIA_CHARACTERS` batches.
- staff pages -> `people`, `credits` with `is_localization`, `weight`.
- characters pages -> `characters`, `character_appearances`, `character_voice_actors`, and VA credits.

Rate limiting uses token-bucket pacing (`REQUESTS_PER_SECOND`, default `0.35`), retry+exponential backoff, and `Retry-After` when present.
