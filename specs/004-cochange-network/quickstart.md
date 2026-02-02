# Quickstart: Co-Change Network Visualization

**Feature**: 004-cochange-network | **Date**: 2026-02-01

Get the co-change network visualization feature running in development in under 5 minutes.

## Prerequisites

- Node.js 20.x (managed via nvm)
- Git repository to analyze
- Existing git-explorer project cloned and dependencies installed

## Quick Start

### 1. Switch to Feature Branch

```bash
git checkout 004-cochange-network
```

### 2. Install Dependencies (if needed)

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Server starts at: `http://localhost:3000`

### 4. Test the Feature

1. Open browser to `http://localhost:3000`
2. Enter a local git repository path (e.g., `/Users/you/projects/my-repo`)
3. Select a time range (default: 3 months)
4. Click "Analyze Repository"
5. Click "Activity Graph" view toggle

**Expected Result**:
- **Phase 1**: See force-directed network graph with example data (nodes connected by lines)
- **Phase 2**: Co-occurrence utility available for testing independently
- **Phase 3**: See your actual repository files with co-change relationship links

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Co-occurrence utility tests
npm test -- data-helpers.test.ts

# ForceGraphChart component tests
npm test -- ForceGraphChart.test.tsx

# Integration tests
npm test -- cochange-integration.test.ts
```

### Watch Mode (TDD)
```bash
npm run test:watch
```

## Phase-Specific Testing

### Phase 1: Visualization Refactor
**What to test**: Graph renders with example data

```bash
# Start dev server
npm run dev

# In browser: Navigate to any repo analysis
# Expected: See network graph with hardcoded nodes and links
# Test: Drag a node - connected links should move with it
```

### Phase 2: Co-Occurrence Utility
**What to test**: Utility function calculations

```bash
# Run unit tests
npm test -- data-helpers.test.ts

# Or use Node.js REPL for manual testing:
node --loader ts-node/esm
> import { calculateCoOccurrence } from './lib/utils/data-helpers.js'
> // Test with sample data...
```

### Phase 3: Full Integration
**What to test**: Real repository data flows through system

```bash
# Point at a real repository with commit history
# Expected: Nodes represent actual files, links show co-change patterns
# Validation: Files that change together frequently should have thick lines
```

## Project Structure Reference

```text
app/
├── components/
│   └── ForceGraphChart.tsx      # Modified for network graph
├── page.tsx                      # Modified to pass GraphData
└── api/git-analysis/route.ts    # Modified to include commits

lib/
├── utils/
│   └── data-helpers.ts           # NEW: Co-occurrence utility
└── treemap/
    └── data-transformer.ts       # Modified for graph transformation

__tests__/
├── components/
│   └── ForceGraphChart.test.tsx  # Updated tests
├── unit/
│   └── data-helpers.test.ts      # NEW: Utility tests
└── integration/
    └── cochange-integration.test.ts  # NEW: E2E tests

specs/004-cochange-network/
├── spec.md                       # Feature specification
├── plan.md                       # This implementation plan
├── research.md                   # Technical research
├── data-model.md                 # Entity definitions
├── contracts/                    # API/component contracts
└── quickstart.md                 # This file
```

## Common Development Tasks

### Add New Test Case
```bash
# 1. Open relevant test file
# 2. Add test following existing patterns
# 3. Run test: npm test -- <filename>
# 4. Implement code to make test pass
```

### Debug Force Simulation
```javascript
// In ForceGraphChart.tsx, add console logs:
simulation.on("tick", () => {
  console.log("Alpha:", simulation.alpha());
  console.log("Node positions:", nodes.map(n => ({id: n.id, x: n.x, y: n.y})));
  // Update rendering...
});
```

### Inspect Co-Occurrence Data
```javascript
// In page.tsx or data-helpers.ts:
const links = calculateCoOccurrence(commits, fileSet);
console.table(links.map(l => ({
  from: l.source,
  to: l.target,
  frequency: l.value
})));
```

### Profile Performance
```javascript
// In browser DevTools:
// 1. Open Performance tab
// 2. Start recording
// 3. Trigger graph render
// 4. Stop recording
// 5. Analyze frame rate and simulation cost
```

## Troubleshooting

### Graph doesn't render
- Check browser console for errors
- Verify `data.nodes` array is not empty
- Check that all link source/target values reference valid node ids

### Simulation runs forever
- Check alpha decay configuration (should be ~0.02)
- Verify maxTicks limit is set (200-300)
- Monitor simulation.alpha() - should decrease to <0.01

### Links don't connect to nodes
- Verify D3 forceLink is initialized with `.id(d => d.id)`
- Check that link source/target are strings matching node ids
- Inspect nodes array for correct id values

### Poor performance / lag
- Reduce number of nodes (check top 50 filter)
- Throttle tick updates with requestAnimationFrame
- Check for excessive console.log calls in tick handler

### Tests failing
- Verify NODE_ENV=test is set (simulation should be skipped)
- Check that mock data matches expected structure
- Run `npm test -- --verbose` for detailed output

## Next Steps

After quickstart:
1. Review [spec.md](spec.md) for feature requirements
2. Review [data-model.md](data-model.md) for entity structures  
3. Review [contracts/](contracts/) for component APIs
4. Follow TDD: Write failing test → implement → refactor

## Resources

- [D3 Force Documentation](https://d3js.org/d3-force)
- [Observable Example Reference](https://observablehq.com/@d3/disjoint-force-directed-graph/2)
- [React + D3 Integration Patterns](https://2019.wattenberger.com/blog/react-and-d3)
- [Next.js App Router Docs](https://nextjs.org/docs/app)

## Support

For questions or issues:
1. Check [spec.md](spec.md) edge cases section
2. Review [research.md](research.md) technical decisions
3. Examine existing tests for usage examples
4. Search codebase for similar patterns
