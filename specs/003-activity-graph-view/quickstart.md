# Quickstart: Activity Graph Visualization

**Date**: 2026-02-01  
**Feature**: Activity Graph Visualization  
**Branch**: 003-activity-graph-view

## Overview

This feature adds a force-directed graph visualization as an alternative view to the existing treemap. Users can toggle between "Heatmap" and "Activity Graph" to see repository file activity in different visual formats.

## Prerequisites

- Node.js 20.x (managed via nvm)
- Existing git-explorer project set up
- Branch `003-activity-graph-view` checked out

## Installation

### 1. Install New Dependencies

```bash
npm install d3-force d3-zoom d3-scale
npm install --save-dev @types/d3-force @types/d3-zoom @types/d3-scale
```

**Why these packages**:
- `d3-force` - Force-directed graph layout simulation
- `d3-zoom` - Pan and zoom interactions for SVG
- `d3-scale` - Scale functions for bubble sizing (specifically scaleSqrt)

Note: `d3` core library is already a peer dependency of `@visx/*` packages.

### 2. Verify Installation

```bash
npm list d3-force d3-zoom d3-scale
```

Expected output should show the installed versions.

## Development Workflow

### 1. Start Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### 2. Run Tests (TDD Workflow)

**Run all tests:**
```bash
npm test
```

**Run tests in watch mode (recommended for TDD):**
```bash
npm run test:watch
```

**Run specific test file:**
```bash
npm test -- file-type-colors.test.ts
```

### 3. TDD Workflow for New Components

Following the constitution's Test-First principle:

#### Example: Creating ViewToggle Component

**Step 1: Write the test first (RED)**
```bash
# Create test file
touch __tests__/components/ViewToggle.test.tsx
```

```typescript
// __tests__/components/ViewToggle.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ViewToggle from '@/app/components/ViewToggle';

describe('ViewToggle', () => {
  it('renders both view options', () => {
    render(<ViewToggle selected="heatmap" onViewChange={jest.fn()} />);
    expect(screen.getByText('Heatmap')).toBeInTheDocument();
    expect(screen.getByText('Activity Graph')).toBeInTheDocument();
  });
  
  it('calls onViewChange when option clicked', () => {
    const onChange = jest.fn();
    render(<ViewToggle selected="heatmap" onViewChange={onChange} />);
    fireEvent.click(screen.getByText('Activity Graph'));
    expect(onChange).toHaveBeenCalledWith('activity-graph');
  });
});
```

**Step 2: Run test and verify it fails (RED)**
```bash
npm test -- ViewToggle.test.tsx
```

Expected: Test fails because ViewToggle component doesn't exist yet.

**Step 3: Implement minimal code to pass (GREEN)**
```bash
# Create component file
touch app/components/ViewToggle.tsx
```

Implement just enough code to pass the tests.

**Step 4: Refactor (REFACTOR)**
Clean up implementation while keeping tests green.

### 4. Linting

```bash
npm run lint
```

## Project Structure

After implementing this feature, the structure will be:

```
git-explorer/
├── app/
│   ├── components/
│   │   ├── ViewToggle.tsx              [NEW]
│   │   ├── ForceGraphChart.tsx         [NEW]
│   │   └── ColorLegend.tsx             [MODIFIED]
│   └── page.tsx                        [MODIFIED]
├── lib/
│   └── treemap/
│       ├── file-type-colors.ts         [NEW]
│       └── data-transformer.ts         [MODIFIED]
├── __tests__/
│   ├── components/
│   │   ├── ViewToggle.test.tsx         [NEW]
│   │   └── ForceGraphChart.test.tsx    [NEW]
│   └── unit/
│       └── file-type-colors.test.ts    [NEW]
└── specs/003-activity-graph-view/
    ├── spec.md
    ├── plan.md
    ├── research.md
    ├── data-model.md
    ├── quickstart.md                    [THIS FILE]
    └── contracts/
```

## Implementation Order

Follow this order to maintain a working application at each step:

### Phase 1: Utilities (No UI impact)
1. **file-type-colors.ts** + tests
   - Pure function, easy to test
   - No dependencies on other new code
   
2. **data-transformer.ts extension** + tests
   - Add `transformTreeToGraph()` function
   - Depends on file-type-colors

### Phase 2: View Toggle (Minimal UI change)
3. **ViewToggle component** + tests
   - Simple UI component
   - Can be tested in isolation
   - Can be added to page without breaking existing functionality

### Phase 3: Force Graph (Major component)
4. **ForceGraphChart component** + tests
   - Most complex component
   - Depends on utilities from Phase 1
   - Initially hidden (not selected by default)

### Phase 4: Integration
5. **Update page.tsx**
   - Add view state
   - Add conditional rendering
   - Both views available

6. **Update ColorLegend**
   - Add mode prop
   - Add discrete rendering
   - Tested with both modes

## Testing Strategy

### Unit Tests
- `file-type-colors.test.ts` - Color mapping logic
- `data-transformer.test.ts` - Tree to graph transformation

### Component Tests
- `ViewToggle.test.tsx` - Toggle interaction and state
- `ForceGraphChart.test.tsx` - Graph rendering and interactions
- `ColorLegend.test.tsx` - Legend mode switching

### Integration Tests
- View switching maintains data
- Repository selection works in both views
- Time range selection works in both views

### Running Tests

```bash
# All tests
npm test

# Specific test suite
npm test -- file-type-colors

# Coverage report
npm test -- --coverage

# Update snapshots (if using)
npm test -- -u
```

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run start            # Start production server

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode for TDD

# Code Quality
npm run lint             # Run ESLint
```

## Debugging

### Force Simulation Not Stabilizing

Check browser console for:
```javascript
console.log('Alpha:', simulation.alpha());
```

If alpha doesn't decrease below 0.001, check force configurations.

### Nodes Not Appearing

Check if nodes array is populated:
```javascript
console.log('Nodes:', nodes);
console.log('Node count:', nodes.length);
```

Verify `transformTreeToGraph()` is extracting leaf nodes correctly.

### Colors Not Matching Spec

Verify color constants:
```javascript
import { FILE_TYPE_COLORS } from '@/lib/treemap/file-type-colors';
console.log(FILE_TYPE_COLORS);
```

### Pan/Zoom Not Working

Check if d3.zoom is attached to SVG:
```javascript
console.log('Zoom behavior:', d3.select(svgRef.current).on('zoom'));
```

## Performance Optimization

### Slow Force Simulation

- Increase `velocityDecay` (e.g., 0.7)
- Decrease node count via API limit
- Add warmup before displaying

### Laggy Pan/Zoom

- Check Chrome DevTools Performance tab
- Ensure using `requestAnimationFrame`
- Verify not re-rendering on every tick

## Browser Compatibility

Tested and supported:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires:
- JavaScript enabled
- SVG support
- ES2020 features

## Environment Variables

None required for this feature. Uses existing environment configuration.

## Troubleshooting

### npm install fails

Try:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Tests fail with module not found

Verify jest.config.js has correct module name mapping:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/$1'
}
```

### TypeScript errors

Run:
```bash
npx tsc --noEmit
```

Fix any type errors before proceeding.

## Next Steps

After setup:
1. Review [data-model.md](data-model.md) for entity definitions
2. Review [contracts/](contracts/) for API contracts
3. Follow TDD workflow to implement each component
4. Refer to [research.md](research.md) for technical decisions

## Getting Help

- Check [research.md](research.md) for implementation patterns
- Check [contracts/](contracts/) for expected behavior
- Review existing components (TreemapChart, DateRangeSelector) for patterns
- Consult d3-force documentation: https://github.com/d3/d3-force
