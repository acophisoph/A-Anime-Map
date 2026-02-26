# Artifact format

Binary assets were replaced with JSON graph/point payloads so repositories and code review systems that do not support binary diffs can still ingest and review artifact changes.

## points.json

```json
{
  "version": 1,
  "points": [
    { "id": 1, "kind": 0, "x": -0.25, "y": 0.12 }
  ]
}
```

- `kind=0` => media
- `kind=1` => person

## graph_*.json

```json
{
  "version": 1,
  "edges": [
    { "source": 1, "target": 2, "weight": 0.8 }
  ]
}
```

Applies to:
- `graph_media_relations.json`
- `graph_media_staff.json`
- `graph_people_collab.json`
