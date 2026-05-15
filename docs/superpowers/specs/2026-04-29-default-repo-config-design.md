# Default Config for Repo Graph

**Issue:** #25
**Date:** 2026-04-29

## Problem

The `DEFAULT_REPO_GRAPH_CONFIG` is a generic pass-through that shows all nodes/edges with uniform styling. We need a meaningful default config that shows how internal processing nodes (function, class, method) interact, with sizing and forces driven by actual code relationships.

## Design

### New Export: `INTERNAL_PROCESSING_CONFIG`

A `RepoGraphConfig` exported from `lib/analysis/graph-config.ts` alongside the existing generic default.

#### Filters

- **Node filter:** Only `SyntaxType.FUNCTION`, `SyntaxType.METHOD`, and `SyntaxType.CLASS`.
- **Edge filter:** Only non-external edges (`!edge.isExternal`).

#### Node Styling

- **Color:** Existing `SYNTAX_TYPE_COLORS` map (blue for functions, purple for classes, etc.).
- **Radius:** Linear from `outboundRefs.length` — `Math.min(Math.max(3 + outboundRefs.length, 3), 30)`. More outbound refs = more complex = larger node.
- **Label:** `false` by default.
- **Opacity:** `1`.

#### Node Forces

- **Charge:** Scaled by `referencedAt.length` — `-(100 + referencedAt.length * 20)`, clamped to `[-600, -100]`. Highly-referenced nodes exert stronger gravitational influence.
- **Collide radius:** Same as style radius + 2px padding.

#### Edge Forces (by EdgeKind)

| Tier | Edge Kinds | Distance | Strength |
|------|-----------|----------|----------|
| Tight | CALLS | 30 | 0.8 |
| Structural | INSTANTIATES, EXTENDS, IMPLEMENTS | 50 | 0.6 |
| Loose | IMPORTS, USES_TYPE | 100 | 0.3 |

#### Simulation Params

Use `DEFAULT_SIMULATION` as-is (no changes needed).

### Wiring

In `app/page.tsx`, import `INTERNAL_PROCESSING_CONFIG` and pass it as the `config` prop to `<RepoGraph>`.

### Tests

Add test cases in `__tests__/unit/graph-config.test.ts`:
- Node filter accepts FUNCTION/METHOD/CLASS, rejects others
- Node filter rejects test-file nodes (if inTestFile)
- Radius scales with outboundRefs count
- Charge scales with referencedAt count
- Edge forces return correct tier values for each EdgeKind
- Edge filter rejects external edges
