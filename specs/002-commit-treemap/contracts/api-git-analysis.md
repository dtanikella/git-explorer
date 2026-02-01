# API Contract: Git Analysis Endpoint

**Endpoint**: `POST /api/git-analysis`  
**Purpose**: Analyze git repository commit history and return treemap data  
**Feature**: 002-commit-treemap

## Request

### Method
`POST`

### Headers
```
Content-Type: application/json
```

### Body Schema

```typescript
interface GitAnalysisRequest {
  /** Absolute path to git repository on server's file system */
  repoPath: string;
  
  /** Time range preset (initially only '2w' supported) */
  timeRange: '2w' | '1m' | '3m' | '6m' | '1y';
}
```

### Example Request

```json
{
  "repoPath": "/Users/username/projects/my-app",
  "timeRange": "2w"
}
```

### Validation Rules

| Field | Required | Constraints | Error Message |
|-------|----------|-------------|---------------|
| `repoPath` | Yes | Non-empty string, absolute path | "Repository path is required" |
| `repoPath` | Yes | Path must exist on server | "Repository path does not exist" (404) |
| `repoPath` | Yes | Must contain `.git` folder | "The selected folder is not a git repository" (400) |
| `timeRange` | Yes | Must be one of: '2w', '1m', '3m', '6m', '1y' | "Invalid time range" (400) |

---

## Response

### Success Response (200 OK)

```typescript
interface GitAnalysisSuccessResponse {
  success: true;
  data: TreeNode;
  metadata: {
    totalFilesAnalyzed: number;
    filesDisplayed: number;
    timeRange: {
      startDate: string;      // ISO 8601
      endDate: string;        // ISO 8601
      midpoint: string;       // ISO 8601
      label: string;
      preset: string;
    };
    analysisDurationMs: number;
  };
}
```

### Example Success Response

```json
{
  "success": true,
  "data": {
    "name": "root",
    "path": "",
    "value": 1523,
    "isFile": false,
    "children": [
      {
        "name": "src",
        "path": "src",
        "value": 1200,
        "isFile": false,
        "children": [
          {
            "name": "App.tsx",
            "path": "src/App.tsx",
            "value": 45,
            "isFile": true,
            "color": "#1a5d1a",
            "fileData": {
              "filePath": "src/App.tsx",
              "totalCommitCount": 45,
              "recentCommitCount": 32,
              "frequencyScore": 0.91
            }
          }
        ]
      }
    ]
  },
  "metadata": {
    "totalFilesAnalyzed": 847,
    "filesDisplayed": 500,
    "timeRange": {
      "startDate": "2026-01-17T00:00:00.000Z",
      "endDate": "2026-01-31T23:59:59.999Z",
      "midpoint": "2026-01-24T12:00:00.000Z",
      "label": "Last 2 weeks",
      "preset": "2w"
    },
    "analysisDurationMs": 2341
  }
}
```

---

### Error Responses

#### 400 Bad Request - Invalid Input

```typescript
interface GitAnalysisErrorResponse {
  success: false;
  error: string;
}
```

**Scenarios**:
- Missing `repoPath`: `{ "success": false, "error": "Repository path is required" }`
- Invalid `timeRange`: `{ "success": false, "error": "Invalid time range" }`
- Not a git repo: `{ "success": false, "error": "The selected folder is not a git repository" }`

#### 403 Forbidden - Permission Error

```json
{
  "success": false,
  "error": "Cannot access the selected repository. Check permissions."
}
```

**Trigger**: Server lacks read permissions for the repository

#### 404 Not Found - Path Does Not Exist

```json
{
  "success": false,
  "error": "Repository path does not exist"
}
```

**Trigger**: `repoPath` points to non-existent directory

#### 500 Internal Server Error - Git Not Installed

```json
{
  "success": false,
  "error": "Git is required. Please install git and try again."
}
```

**Trigger**: `simple-git` cannot find git binary

#### 500 Internal Server Error - Analysis Failure

```json
{
  "success": false,
  "error": "Failed to analyze repository. Check console for details."
}
```

**Trigger**: Unexpected error during git log parsing or tree building

---

## Response Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | Success | Analysis completed successfully |
| 400 | Bad Request | Invalid input (missing fields, invalid format, not a git repo) |
| 403 | Forbidden | Permission denied accessing repository |
| 404 | Not Found | Repository path does not exist |
| 500 | Internal Error | Git not installed, analysis failure, unexpected error |

---

## Performance Expectations

Per Success Criteria:

- **SC-001**: Analysis completes in <10 seconds for repositories with up to 10,000 files
- **SC-007**: Switching time ranges updates visualization within 5 seconds

**Timeout**: Client should implement 30-second timeout for large repositories

---

## Usage Example

```typescript
// Client-side fetch
async function analyzeRepository(repoPath: string, timeRange: string) {
  try {
    const response = await fetch('/api/git-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, timeRange }),
    });
    
    const result: GitAnalysisSuccessResponse | GitAnalysisErrorResponse = 
      await response.json();
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result.data;  // TreeNode for visualization
    
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}
```

---

## Testing Contract

Test files validating this contract:

- `__tests__/integration/git-analysis-api.test.ts`
  - ✅ Returns 200 with valid tree data for valid repo
  - ✅ Returns 400 for missing repoPath
  - ✅ Returns 400 for non-git directory
  - ✅ Returns 404 for non-existent path
  - ✅ Returns 403 for permission-denied directory
  - ✅ Returns 500 when git not installed (mocked)
  - ✅ Metadata contains correct file counts and time range
  - ✅ Tree data matches expected structure (root → children → files)

---

## Changes from Initial Design

**2026-01-31**: Initial contract definition
- Removed File System Access API (replaced with simple path input)
- Added `metadata` to success response for transparency
- Standardized error response format
- Added ISO 8601 date strings in metadata (serializable)
