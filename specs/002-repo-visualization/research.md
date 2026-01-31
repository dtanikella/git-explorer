# Research: Interactive Repository Visualization

**Feature**: 002-repo-visualization  
**Date**: January 31, 2026  
**Status**: Complete

---

## 1. Visualization Library Selection

### Decision: @visx/hierarchy + @visx/zoom

**Rationale**: 
- React-native: Components integrate naturally with React state and props, no imperative DOM manipulation
- Tree-shakeable: Import only `@visx/hierarchy` (Pack), `@visx/zoom`, `@visx/tooltip` — small bundle impact
- Built on D3: Uses `d3-hierarchy` under the hood, same proven circle-packing algorithm as GitHub Next
- Pluggable rendering: `<Pack />` component accepts custom `radius` function and render children, perfect for strategy pattern
- Active maintenance: Airbnb-maintained, 20k+ GitHub stars, regular updates

**Alternatives Considered**:

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **D3.js (raw)** | Maximum control, most examples | Imperative (fights React), manual DOM reconciliation, larger bundle | ❌ Rejected |
| **react-d3-library** | Wraps D3 for React | Thin wrapper, still imperative at core, less maintained | ❌ Rejected |
| **Recharts** | Simple charting | No circle-packing support | ❌ Not applicable |
| **Nivo** | React charts with hierarchy | More opinionated, harder to customize node rendering | ❌ Less flexible |

---

## 2. Circle Packing Implementation Pattern

### Decision: @visx/hierarchy `<Pack />` with custom node renderer

**Pattern**:
```tsx
import { Pack, hierarchy } from '@visx/hierarchy';

const root = hierarchy(fileTree)
  .sum(sizingStrategy)  // Pluggable: determines circle size
  .sort((a, b) => b.value! - a.value!);

<Pack root={root} size={[width, height]} padding={2}>
  {(packData) => packData.descendants().map((node) => (
    <CircleNode 
      key={node.data.path}
      node={node}
      fill={coloringStrategy(node.data)}  // Pluggable: determines color
      onHover={handleHover}
      onClick={handleClick}
    />
  ))}
</Pack>
```

**Key Insights**:
- `hierarchy().sum()` accepts the sizing strategy function directly
- Coloring is applied at render time via the custom node component
- Both strategies are pure functions, easily testable in isolation
- Node data (`node.data`) contains the original `FileNode`, strategies receive typed input

---

## 3. Pan/Zoom Implementation

### Decision: @visx/zoom with SVG transform

**Pattern**:
```tsx
import { Zoom } from '@visx/zoom';

<Zoom
  width={width}
  height={height}
  scaleXMin={0.1}
  scaleXMax={10}
  initialTransformMatrix={initialTransform}
>
  {(zoom) => (
    <svg>
      <g transform={zoom.toString()}>
        {/* Pack visualization here */}
      </g>
      <rect 
        fill="transparent" 
        width={width} 
        height={height}
        onWheel={zoom.handleWheel}
        onMouseDown={zoom.dragStart}
        onMouseMove={zoom.dragMove}
        onMouseUp={zoom.dragEnd}
        onDoubleClick={() => zoom.reset()}
      />
    </svg>
  )}
</Zoom>
```

**Key Insights**:
- Zoom state managed by `@visx/zoom`, no custom state needed
- Transform applied to inner `<g>` group, interaction captured on outer `<rect>`
- `zoom.reset()` on double-click satisfies FR-023
- Smooth 60fps achieved via CSS `transform` (GPU-accelerated)

---

## 4. Tooltip Implementation

### Decision: @visx/tooltip with portal rendering

**Pattern**:
```tsx
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';

const { tooltipOpen, tooltipData, showTooltip, hideTooltip } = useTooltip<FileNode>();

// On circle hover:
onMouseEnter={(e) => showTooltip({ 
  tooltipData: node.data,
  tooltipLeft: e.clientX,
  tooltipTop: e.clientY 
})}
onMouseLeave={hideTooltip}

// Render tooltip:
{tooltipOpen && (
  <TooltipWithBounds left={tooltipLeft} top={tooltipTop}>
    <div>{tooltipData.name}</div>
    <div>{tooltipData.path}</div>
    <div>{formatBytes(tooltipData.size)}</div>
  </TooltipWithBounds>
)}
```

**Key Insights**:
- `TooltipWithBounds` auto-positions to stay in viewport
- Tooltip follows cursor, appears instantly (<100ms)
- Separate tooltip for files vs folders (different content per FR-020)

---

## 5. Filesystem Scanning (API Route)

### Decision: Node.js `fs` with recursive directory walk

**Pattern**:
```ts
// app/api/file-tree/route.ts
import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';

async function buildTree(dirPath: string): Promise<FileNode> {
  const stats = await stat(dirPath);
  const name = basename(dirPath);
  
  if (!stats.isDirectory()) {
    return {
      path: dirPath,
      name,
      type: 'file',
      size: stats.size,
      extension: extname(name),
      metadata: {},
    };
  }
  
  const entries = await readdir(dirPath, { withFileTypes: true });
  const children = await Promise.all(
    entries
      .filter(e => !e.name.startsWith('.'))  // Skip hidden files
      .map(e => buildTree(join(dirPath, e.name)))
  );
  
  return {
    path: dirPath,
    name,
    type: 'folder',
    size: children.reduce((sum, c) => sum + (c.size || 0), 0),
    children,
    metadata: {},
  };
}
```

**Key Insights**:
- Recursive `Promise.all` for parallel directory reading
- Hidden files (`.git`, `.env`) filtered by default
- Folder `size` = sum of children sizes (for sizing strategy)
- `metadata` object present but empty (future git integration)
- Symlinks: `fs.stat` follows symlinks by default (per edge case spec)

**Validation**:
```ts
// Validate path exists and is directory before scanning
const stats = await stat(path).catch(() => null);
if (!stats) return { error: 'Path does not exist' };
if (!stats.isDirectory()) return { error: 'Path must be a directory' };
```

---

## 6. Extension Color Palette

### Decision: 12-color palette for common file types

| Extension | Color | Hex |
|-----------|-------|-----|
| `.ts`, `.tsx` | Blue | `#3178c6` |
| `.js`, `.jsx` | Yellow | `#f7df1e` |
| `.css`, `.scss` | Purple | `#663399` |
| `.json` | Orange | `#f5a623` |
| `.md` | Teal | `#00d4aa` |
| `.html` | Red-Orange | `#e34c26` |
| `.yml`, `.yaml` | Pink | `#cb171e` |
| `.py` | Green | `#3572a5` |
| `.rb` | Ruby Red | `#cc342d` |
| `.go` | Cyan | `#00add8` |
| `.rs` | Rust Orange | `#dea584` |
| (other) | Gray | `#8b8b8b` |
| (folder) | Light Gray | `#e0e0e0` (semi-transparent) |

**Rationale**: Colors chosen for distinctiveness and familiarity (TypeScript blue, JS yellow match official branding).

---

## 7. Test Strategy (TDD Compliance)

Per Constitution Principle I, all code follows Red-Green-Refactor:

### Unit Tests (`__tests__/lib/`)
- `file-tree.test.ts`: Mock filesystem, verify tree structure matches expected hierarchy
- `sizing.test.ts`: Verify `fileSizeStrategy` returns correct values, edge cases (0 bytes, folders)
- `coloring.test.ts`: Verify `extensionColorStrategy` maps correctly, unknown extensions → gray

### Component Tests (`__tests__/components/`)
- `PathInput.test.tsx`: Validation states (empty, valid, invalid), submit behavior
- `CirclePackingChart.test.tsx`: Renders correct number of circles, applies colors, hover triggers tooltip

### Integration Tests (`__tests__/api/`)
- `file-tree.test.ts`: API route returns valid JSON, handles errors correctly

---

## 8. Dependencies to Add

```json
{
  "@visx/hierarchy": "^3.x",
  "@visx/zoom": "^3.x", 
  "@visx/tooltip": "^3.x",
  "@visx/group": "^3.x",
  "@visx/scale": "^3.x"
}
```

No additional backend dependencies needed (using Node.js built-in `fs`).

---

## Summary

All technical decisions resolved. No NEEDS CLARIFICATION items remain. Ready for Phase 1 design artifacts.
