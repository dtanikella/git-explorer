# git-explorer Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-31

## Active Technologies
- N/A (reads filesystem on-demand, no persistence) (002-repo-visualization)
- TypeScript 5 / Node.js (Next.js 16.1.6, React 19.2.3) + `simple-git` (git operations), `@visx/hierarchy` (treemap), `@visx/scale` (color scales), `@visx/tooltip` (deferred - P4) (002-commit-treemap)
- N/A (stateless, analyzes repositories on-demand) (002-commit-treemap)
- TypeScript 5.x with React 19.2.3 + Next.js 16.1.6, d3-force (to be added), d3-zoom (to be added), @visx/hierarchy 3.12.0 (003-activity-graph-view)
- N/A (client-side visualization of server-processed git data) (003-activity-graph-view)
- TypeScript 5.x with Next.js 16.1.6 (React 19.2.3) + D3.js (d3-force 3.0.0, d3-scale 4.0.2, d3-zoom 3.0.0, d3-selection via imports), simple-git 3.30.0 for git operations (004-cochange-network)
- N/A (no persistent storage, data computed on-demand from git repository) (004-cochange-network)

- TypeScript 5.x (strict mode) + @visx/hierarchy (circle packing), @visx/zoom (pan/zoom), @visx/tooltip (hover), React 19.x (002-repo-visualization)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (strict mode): Follow standard conventions

## Recent Changes
- 004-cochange-network: Added TypeScript 5.x with Next.js 16.1.6 (React 19.2.3) + D3.js (d3-force 3.0.0, d3-scale 4.0.2, d3-zoom 3.0.0, d3-selection via imports), simple-git 3.30.0 for git operations
- 003-activity-graph-view: Added TypeScript 5.x with React 19.2.3 + Next.js 16.1.6, d3-force (to be added), d3-zoom (to be added), @visx/hierarchy 3.12.0
- 002-commit-treemap: Added TypeScript 5 / Node.js (Next.js 16.1.6, React 19.2.3) + `simple-git` (git operations), `@visx/hierarchy` (treemap), `@visx/scale` (color scales), `@visx/tooltip` (deferred - P4)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
