# Contract: Co-Occurrence Utility

**Version**: 1.0.0 | **File**: `lib/utils/data-helpers.ts`

## Function: `calculateCoOccurrence`

Calculates file pair co-occurrence frequencies from commit records.

### Signature

```typescript
function calculateCoOccurrence(
  commits: CommitRecord[],
  fileIds: Set<string>
): GraphLink[]
```

### Parameters

**commits** (`CommitRecord[]`)
- Array of commit records to analyze
- Each commit contains `sha`, `date`, and `files` array
- Must not be null/undefined
- Can be empty array (returns empty links)

**fileIds** (`Set<string>`)
- Set of file paths to include in analysis (typically top 50)
- Used to filter commit.files before pair generation
- Must not be null/undefined
- Can be empty set (returns empty links)

### Returns

**GraphLink[]**
- Array of link objects with `{source, target, value}` structure
- `source` and `target` are file path strings (from fileIds set)
- `value` is co-occurrence frequency (number of commits where both files appear)
- Links only created for file pairs that co-occurred at least once
- No duplicate links (each unique pair appears once)
- No self-loops (source !== target)

### Behavior

1. **Filter files per commit**: For each commit, filter `commit.files` to only include files in `fileIds` set
2. **Generate pairs**: Create all unique pairs (i, j) where i < j from filtered file list
3. **Count occurrences**: For each pair, increment counter in internal map
4. **Create links**: Transform map entries to GraphLink objects
5. **Return**: Array of all links with co-occurrence count ≥1

### Algorithm Complexity

- **Time**: O(C × F²) where C = number of commits, F = average files per commit after filtering
- **Space**: O(N²) where N = number of unique files (max 50), theoretical max 1,225 links
- **Typical case**: 1000 commits × 3 files/commit = 3000 pair operations

### Examples

```typescript
// Example 1: Simple co-occurrence
const commits = [
  { sha: "abc", date: new Date(), files: ["fileA.ts", "fileB.ts"] },
  { sha: "def", date: new Date(), files: ["fileA.ts", "fileB.ts"] },
  { sha: "ghi", date: new Date(), files: ["fileB.ts", "fileC.ts"] },
];
const fileIds = new Set(["fileA.ts", "fileB.ts", "fileC.ts"]);

const links = calculateCoOccurrence(commits, fileIds);
// Returns:
// [
//   { source: "fileA.ts", target: "fileB.ts", value: 2 },  // Co-occurred in 2 commits
//   { source: "fileB.ts", target: "fileC.ts", value: 1 },  // Co-occurred in 1 commit
// ]
// Note: No link for fileA-fileC (never co-occurred)

// Example 2: Empty commits
const links2 = calculateCoOccurrence([], fileIds);
// Returns: []

// Example 3: Single file per commit
const commits3 = [
  { sha: "abc", date: new Date(), files: ["fileA.ts"] },
  { sha: "def", date: new Date(), files: ["fileB.ts"] },
];
const links3 = calculateCoOccurrence(commits3, fileIds);
// Returns: [] (no co-occurrences)

// Example 4: Filtering to top 50
const commits4 = [
  { sha: "abc", date: new Date(), files: ["fileA.ts", "fileB.ts", "fileZ.ts"] },
];
const fileIds4 = new Set(["fileA.ts", "fileB.ts"]); // fileZ not in top 50
const links4 = calculateCoOccurrence(commits4, fileIds4);
// Returns: [{ source: "fileA.ts", target: "fileB.ts", value: 1 }]
// fileZ excluded from pair generation
```

### Edge Cases

| Case | Input | Output | Notes |
|------|-------|--------|-------|
| No commits | `[]` | `[]` | No data to analyze |
| Empty fileIds | `Set([])` | `[]` | No files to track |
| Single file in fileIds | `Set(["a.ts"])` | `[]` | Cannot form pairs |
| No overlapping commits | All commits have different files | `[]` | No co-occurrences |
| All commits same files | Every commit has [A, B] | `[{source: A, target: B, value: N}]` | N = commit count |
| Large commit (many files) | Commit with 20 files | Generates 190 pairs | (20 choose 2) = 190 |

### Error Handling

**Throws**: Never throws exceptions
**Invalid Input**: Returns empty array for:
- Null/undefined commits or fileIds
- Non-array commits
- Non-Set fileIds

**Validation**: 
- Silently skips commits with missing/invalid `files` property
- Filters out non-string file paths
- Handles duplicate files in same commit (treats as single occurrence)

### Testing Contract

Tests must cover:
1. ✅ Basic co-occurrence counting (2+ commits with same file pair)
2. ✅ No co-occurrence (files never together)
3. ✅ Empty inputs ([], empty Set)
4. ✅ Single file scenarios
5. ✅ Filtering behavior (files outside fileIds excluded)
6. ✅ Multiple relationships per file (A-B, A-C, B-C)
7. ✅ Large commit with many files
8. ✅ Symmetric pairs (AB === BA, only one link created)

### Performance Characteristics

**Optimized for**:
- Small to medium datasets (typical: 1000 commits, 50 files)
- Client-side calculation (runs in browser)
- One-time calculation per analysis

**Not optimized for**:
- Streaming commits (requires full array)
- Very large repositories (>10,000 commits)
- Real-time updates (recalculates from scratch)

### Dependencies

- `CommitRecord` type from `lib/git/types.ts`
- `GraphLink` type from `lib/treemap/data-transformer.ts`
- Standard JavaScript Map for co-occurrence tracking

### Version History

**1.0.0** (2026-02-01)
- Initial implementation
- Basic co-occurrence counting with pair generation
