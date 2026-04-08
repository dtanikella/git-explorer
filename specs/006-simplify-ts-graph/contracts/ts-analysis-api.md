# API Contract: POST /api/ts-analysis

**Date**: 2026-04-08
**Feature**: [spec.md](../spec.md)

## Endpoint

`POST /api/ts-analysis`

## Request

### Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |

### Body

```json
{
  "repoPath": "/path/to/repo",
  "hideTestFiles": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `repoPath` | `string` | Yes | — | Absolute path to the repository root |
| `hideTestFiles` | `boolean` | No | `true` | When true, exclude test files from analysis |

**Test file patterns** (when `hideTestFiles=true`):
- `*.test.ts`
- `*.test.tsx`
- `*.spec.ts`
- `*.spec.tsx`
- Any file within a `__tests__/` directory

## Response

### Success (200)

```json
{
  "success": true,
  "data": {
    "nodes": [
      { "id": "folder:.", "kind": "FOLDER", "parent": null, "children": [...], "siblings": [...], "name": "repo", "path": "/abs/path", "depth": 0 },
      { "id": "file:src/index.ts", "kind": "FILE", "parent": "folder:src", "children": [...], "siblings": [...], "name": "index.ts", "path": "/abs/path", "fileType": "ts" },
      { "id": "fn:src/index.ts:main", "kind": "FUNCTION", "parent": "file:src/index.ts", "children": [], "siblings": [...], "name": "main", "params": [...], "returnType": "void" }
    ],
    "edges": [
      { "id": "edge-0", "type": "contains", "source": "folder:.", "target": "folder:src" },
      { "id": "edge-1", "type": "contains", "source": "folder:src", "target": "file:src/index.ts" },
      { "id": "edge-2", "type": "call", "source": "fn:src/index.ts:main", "target": "fn:src/index.ts:helper", "callScope": "same-file" }
    ]
  },
  "metadata": {
    "nodeCount": 3,
    "edgeCount": 3,
    "analysisDurationMs": 142
  }
}
```

**Key changes from current behavior**:
- `edges` array contains only `contains` and `call` type edges (no `import` or `export`)
- `nodes` array does not include `IMPORT` kind nodes
- When `hideTestFiles=true`: no nodes with `inTestFile=true`, no test file `FILE` nodes, no empty folders

### Error: Missing repoPath (400)

```json
{
  "success": false,
  "error": "Repository path is required"
}
```

### Error: Path not found (404)

```json
{
  "success": false,
  "error": "Repository path does not exist"
}
```

### Error: No tsconfig.json (400)

```json
{
  "success": false,
  "error": "No tsconfig.json found in the repository"
}
```

### Error: Internal error (500)

```json
{
  "success": false,
  "error": "Internal server error"
}
```
