# API Contracts: Interactive Repository Visualization

**Feature**: 002-repo-visualization  
**Date**: January 31, 2026

---

## POST /api/file-tree

Scans the filesystem at the provided path and returns a hierarchical tree structure.

### Request

**Method**: `POST`  
**Content-Type**: `application/json`

```json
{
  "path": "/absolute/path/to/repository"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | Absolute path to the repository directory |

### Response: Success (200 OK)

```json
{
  "success": true,
  "data": {
    "path": "/Users/dev/my-repo",
    "name": "my-repo",
    "type": "folder",
    "size": 1048576,
    "extension": "",
    "metadata": {},
    "children": [
      {
        "path": "/Users/dev/my-repo/src",
        "name": "src",
        "type": "folder",
        "size": 524288,
        "extension": "",
        "metadata": {},
        "children": [
          {
            "path": "/Users/dev/my-repo/src/index.ts",
            "name": "index.ts",
            "type": "file",
            "size": 2048,
            "extension": ".ts",
            "metadata": {}
          }
        ]
      },
      {
        "path": "/Users/dev/my-repo/README.md",
        "name": "README.md",
        "type": "file",
        "size": 1024,
        "extension": ".md",
        "metadata": {}
      }
    ]
  },
  "stats": {
    "totalFiles": 42,
    "totalFolders": 8,
    "totalSize": 1048576
  }
}
```

### Response: Error (400 Bad Request)

#### Empty Path

```json
{
  "success": false,
  "error": {
    "code": "EMPTY_PATH",
    "message": "Please enter a path"
  }
}
```

#### Path Not Found

```json
{
  "success": false,
  "error": {
    "code": "PATH_NOT_FOUND",
    "message": "Path does not exist"
  }
}
```

#### Not a Directory

```json
{
  "success": false,
  "error": {
    "code": "NOT_A_DIRECTORY",
    "message": "Path must be a directory"
  }
}
```

#### Permission Denied

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Cannot read path: permission denied"
  }
}
```

### Response: Error (500 Internal Server Error)

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

---

## Error Codes Reference

| Code | HTTP Status | User Message | Cause |
|------|-------------|--------------|-------|
| `EMPTY_PATH` | 400 | "Please enter a path" | Request body missing or `path` is empty string |
| `PATH_NOT_FOUND` | 400 | "Path does not exist" | `fs.stat()` fails with ENOENT |
| `NOT_A_DIRECTORY` | 400 | "Path must be a directory" | Path exists but `stats.isDirectory()` returns false |
| `PERMISSION_DENIED` | 400 | "Cannot read path: permission denied" | `fs.readdir()` fails with EACCES |
| `INTERNAL_ERROR` | 500 | "An unexpected error occurred" | Any other unhandled error |

---

## OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: Git Explorer File Tree API
  version: 1.0.0
paths:
  /api/file-tree:
    post:
      summary: Scan repository and return file tree
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - path
              properties:
                path:
                  type: string
                  description: Absolute path to repository
      responses:
        '200':
          description: File tree successfully scanned
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ScanSuccessResponse'
        '400':
          description: Invalid path or validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ScanErrorResponse'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ScanErrorResponse'

components:
  schemas:
    FileNode:
      type: object
      required:
        - path
        - name
        - type
        - size
        - extension
        - metadata
      properties:
        path:
          type: string
        name:
          type: string
        type:
          type: string
          enum: [file, folder]
        size:
          type: integer
          minimum: 0
        extension:
          type: string
        metadata:
          type: object
          additionalProperties: true
        children:
          type: array
          items:
            $ref: '#/components/schemas/FileNode'
    
    ScanSuccessResponse:
      type: object
      required:
        - success
        - data
        - stats
      properties:
        success:
          type: boolean
          const: true
        data:
          $ref: '#/components/schemas/FileNode'
        stats:
          type: object
          properties:
            totalFiles:
              type: integer
            totalFolders:
              type: integer
            totalSize:
              type: integer
    
    ScanErrorResponse:
      type: object
      required:
        - success
        - error
      properties:
        success:
          type: boolean
          const: false
        error:
          type: object
          required:
            - code
            - message
          properties:
            code:
              type: string
              enum: [EMPTY_PATH, PATH_NOT_FOUND, NOT_A_DIRECTORY, PERMISSION_DENIED, INTERNAL_ERROR]
            message:
              type: string
```
