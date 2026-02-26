# Ingest debugging

## Common commands

```bash
sqlite3 scripts/.cache/anime-atlas.sqlite "select batch_type,status,count(*) from batches group by 1,2 order by 1,2;"
sqlite3 scripts/.cache/anime-atlas.sqlite "select * from batches where status='FAILED' order by updated_at desc limit 20;"
sqlite3 scripts/.cache/anime-atlas.sqlite "select count(*) from media;"
```

## Failure modes

- Lease conflict: another runner currently owns `leases.name='ingest'`.
- Rate limiting/transient network errors: retried with backoff and optional `Retry-After` honor.
- Partial artifacts: expected during incremental ingest; check `manifest.json` completeness flags.
