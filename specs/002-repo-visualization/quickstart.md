# Quickstart: Interactive Repository Visualization

**Feature**: 002-repo-visualization  
**Date**: January 31, 2026

---

## Prerequisites

- Node.js 18+ installed
- npm installed
- Git Explorer repository cloned

---

## 1. Install Dependencies

```bash
cd git-explorer
npm install
```

New dependencies for this feature (already added to package.json):
- `@visx/hierarchy` — Circle packing layout
- `@visx/zoom` — Pan and zoom interactions
- `@visx/tooltip` — Hover tooltips
- `@visx/group` — SVG group component
- `@visx/scale` — Scale utilities

---

## 2. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 3. Use the Visualization

1. **Enter a repository path** in the input field (e.g., `/Users/you/projects/my-repo`)
2. **Click "Visualize"** or press Enter
3. **Explore the visualization**:
   - **Hover** over any circle to see file/folder details
   - **Scroll** to zoom in/out
   - **Click and drag** to pan
   - **Double-click** to reset zoom

---

## 4. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- __tests__/lib/file-tree.test.ts
```

---

## Project Structure Overview

```
app/
├── page.tsx                    # Main page (path input + visualization)
├── api/file-tree/route.ts      # API: scans filesystem
└── components/
    ├── PathInput.tsx           # Input with validation
    ├── RepoVisualization.tsx   # Zoom wrapper
    ├── CirclePackingChart.tsx  # Circle packing SVG
    └── Tooltip.tsx             # Hover tooltip

lib/
├── types.ts                    # FileNode, strategies
├── file-tree.ts                # Tree building logic
└── strategies/
    ├── sizing.ts               # Size by file bytes
    └── coloring.ts             # Color by extension
```

---

## Customizing Strategies

### Custom Sizing Strategy

```tsx
import { SizingStrategy } from '@/lib/types';

// All circles same size
const uniformStrategy: SizingStrategy = () => 1;

// Use in component
<CirclePackingChart 
  data={fileTree} 
  sizingStrategy={uniformStrategy} 
/>
```

### Custom Coloring Strategy

```tsx
import { ColoringStrategy } from '@/lib/types';

// Color by file vs folder
const typeColorStrategy: ColoringStrategy = (node) => 
  node.type === 'folder' ? '#e0e0e0' : '#3178c6';

// Use in component
<CirclePackingChart 
  data={fileTree} 
  coloringStrategy={typeColorStrategy} 
/>
```

---

## Troubleshooting

### "Path does not exist"
- Ensure the path is absolute (starts with `/` on macOS/Linux or `C:\` on Windows)
- Check for typos in the path

### "Path must be a directory"
- The path points to a file, not a folder
- Enter the parent directory path instead

### Visualization is slow
- Repositories with 5,000+ files may have slower initial render
- Performance optimization is planned for a future iteration

### Circles overlap or look wrong
- Try resizing the browser window (visualization responds to container size)
- Double-click to reset zoom if the view is off-center

---

## Next Steps

After completing this feature:
1. **Add git integration** (commit count, change frequency) — planned for future
2. **Add strategy switcher UI** — toggle sizing/coloring modes
3. **Add click-to-drill-down** — zoom into specific folders
