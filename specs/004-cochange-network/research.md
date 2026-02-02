# Research: Co-Change Network Visualization

**Feature**: 004-cochange-network | **Date**: 2026-02-01

## Phase 0: Outline & Research

### Research Questions

Based on Technical Context and feature requirements, the following areas need investigation:

1. **D3 Force-Directed Graph with Links**
   - How does the Observable example implement continuous tick-based updates?
   - What are the correct D3 force configurations for link forces?
   - How to handle React re-renders with continuous simulation ticks?

2. **Co-Occurrence Algorithm**
   - Best data structure for tracking file pair frequencies (Map vs object)?
   - How to efficiently generate all file pairs from commit data?
   - Performance characteristics with 50 files (max 1,225 potential links)?

3. **Visual Encoding Scales**
   - D3 scale types for mapping co-occurrence frequency to line thickness?
   - Inverse distance scaling: how to map high frequency → short distance?
   - Scale domain determination (min/max co-change values)?

### Research Findings

#### 1. D3 Force-Directed Graph Implementation

**Decision**: Use continuous simulation with `simulation.on("tick", callback)` pattern from Observable example

**Rationale**: 
- Observable example demonstrates the canonical D3 approach for network graphs with links
- Continuous tick updates enable smooth real-time dragging of connected nodes
- React integration pattern: store simulation in ref, update state on tick to trigger re-render
- Current implementation pre-computes positions, which won't work properly with link forces that need continuous adjustment

**Implementation Pattern**:
```typescript
// From Observable example:
simulation.on("tick", () => {
  // Update link positions
  link
    .attr("x1", d => d.source.x)
    .attr("x2", d => d.target.x);
  // Update node positions  
  node
    .attr("cx", d => d.x)
    .attr("cy", d => d.y);
});
```

**React Adaptation**:
- Store simulation in `useRef` (already done)
- Store nodes in state, update on tick: `setNodes([...nodes])`
- Use `requestAnimationFrame` throttling to limit re-renders to 60fps
- Dragging: Set `node.fx/fy` (fixed position) during drag, clear on drag end

**Alternatives Considered**:
- Pre-compute layout: Rejected because link forces require continuous adjustment during dragging
- External force simulator library: Rejected per YAGNI principle, D3 is already a dependency

#### 2. Co-Occurrence Calculation

**Decision**: Use `Map<string, number>` with sorted file pair keys

**Rationale**:
- Map provides O(1) lookup and avoids prototype pollution issues with plain objects
- Sort file paths to create consistent keys: `[fileA, fileB].sort().join("::")` ensures AB === BA
- Nested loops over commit.files arrays: O(n × m²) where n=commits, m=avg files per commit
- With 50 files, max 1,225 links (50 choose 2), manageable for client-side processing

**Algorithm**:
```typescript
function calculateCoOccurrence(commits: CommitRecord[], fileSet: Set<string>) {
  const linkMap = new Map<string, number>();
  
  for (const commit of commits) {
    const files = commit.files.filter(f => fileSet.has(f));
    // Generate all pairs
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = [files[i], files[j]].sort().join("::");
        linkMap.set(key, (linkMap.get(key) || 0) + 1);
      }
    }
  }
  
  return linkMap;
}
```

**Performance Analysis**:
- Typical commit: 3-5 files modified → 3-10 pairs per commit
- 1000 commits × 5 pairs/commit = 5000 pair operations
- With Map lookup O(1), total ~O(commits × files²) acceptable for client-side

**Alternatives Considered**:
- Object with string keys: Rejected due to prototype pollution risk
- Adjacency matrix: Rejected as overkill for sparse graph (most file pairs never co-occur)
- Server-side calculation: Rejected to minimize API changes in Phase 2, can optimize later if needed

#### 3. Visual Encoding Scales

**Decision**: Use `d3.scaleLinear()` for both stroke width and link distance

**Rationale**:
- Linear scales are intuitive: double the co-changes → double the visual difference
- D3 provides built-in clamping with `.clamp(true)` for edge cases
- Inverse distance achieved by reversing range: `.range([100, 10])` (high value → short distance)

**Stroke Width Scale**:
```typescript
const strokeWidthScale = d3.scaleLinear()
  .domain([minCoChanges, maxCoChanges])  // From data
  .range([1, 5])                         // 1px to 5px
  .clamp(true);                          // Handle outliers
```

**Link Distance Scale** (inverse):
```typescript
const linkDistanceScale = d3.scaleLinear()
  .domain([minCoChanges, maxCoChanges])  // From data
  .range([100, 10])                      // High frequency → short distance
  .clamp(true);
```

**Edge Case Handling**:
- All links same frequency (minCoChanges === maxCoChanges): Use fixed values (3px, 55px middle of range)
- Single link: Use minimum values (1px, 100px)
- No links: Skip visual encoding (no links to render)

**Alternatives Considered**:
- Square root scale (like current radius): Rejected because co-change frequency is already a count, linear easier to interpret
- Logarithmic scale: Rejected unless frequency spans multiple orders of magnitude (unlikely with top 50 files)
- Threshold-based (e.g., <5 = thin, 5-10 = medium, >10 = thick): Rejected as less precise than continuous scale

### Technology Decisions

| Technology | Choice | Rationale |
|------------|--------|-----------|
| Force simulation pattern | Continuous tick updates | Required for smooth link-based dragging |
| Co-occurrence data structure | `Map<string, number>` | O(1) lookup, no prototype pollution |
| Pair key format | Sorted paths joined by `::` | Ensures AB === BA consistency |
| Stroke width scale | `d3.scaleLinear()` range [1, 5] | Linear mapping intuitive for counts |
| Link distance scale | `d3.scaleLinear()` range [100, 10] (inverted) | High frequency → proximity |
| Re-render throttling | `requestAnimationFrame` | 60fps cap for performance |

### Open Questions

None remaining - all technical decisions documented with rationale.

### Risk Mitigation

| Risk | Mitigation Strategy |
|------|---------------------|
| Too many links clutters graph | Limit to top 50 files (max 1,225 links), can add threshold filter in future if needed |
| Continuous re-renders impact performance | Throttle updates with requestAnimationFrame, monitor FPS in browser devtools |
| Commit data too large for HTTP response | Start with full commit data, can optimize to pre-calculate links server-side if payload exceeds ~1MB |
| Force simulation doesn't stabilize | Use D3 default alpha decay (0.0228), can tune if needed based on testing |

## References

- [Observable D3 Force-Directed Graph Example](https://observablehq.com/@d3/disjoint-force-directed-graph/2)
- [D3 Force Documentation](https://d3js.org/d3-force)
- [D3 Scale Documentation](https://d3js.org/d3-scale)
- Current implementation: `app/components/ForceGraphChart.tsx`
- Existing types: `lib/git/types.ts` (CommitRecord interface)
