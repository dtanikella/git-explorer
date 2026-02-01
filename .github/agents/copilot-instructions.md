# git-explorer Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-31

## Active Technologies
- N/A (reads filesystem on-demand, no persistence) (002-repo-visualization)
- TypeScript 5 / Node.js (Next.js 16.1.6, React 19.2.3) + `simple-git` (git operations), `@visx/hierarchy` (treemap), `@visx/scale` (color scales), `@visx/tooltip` (deferred - P4) (002-commit-treemap)
- N/A (stateless, analyzes repositories on-demand) (002-commit-treemap)

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
- 002-commit-treemap: Added TypeScript 5 / Node.js (Next.js 16.1.6, React 19.2.3) + `simple-git` (git operations), `@visx/hierarchy` (treemap), `@visx/scale` (color scales), `@visx/tooltip` (deferred - P4)
- 002-repo-visualization: Added TypeScript 5.x (strict mode) + @visx/hierarchy (circle packing), @visx/zoom (pan/zoom), @visx/tooltip (hover), React 19.x

- 002-repo-visualization: Added TypeScript 5.x (strict mode) + @visx/hierarchy (circle packing), @visx/zoom (pan/zoom), @visx/tooltip (hover), React 19.x

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
