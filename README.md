# Git Explorer

A Next.js app that visualizes TypeScript codebases as an interactive symbol graph. Point it at a local repo, and it builds a force-directed graph of functions, classes, methods, and interfaces plus their call/import/extends relationships.

The analysis uses a real [SCIP](https://github.com/sourcegraph/scip) index and a tree-sitter parse — not a toy AST walk.

## Features

- **Symbol graph**: force-directed canvas visualization of functions, classes, methods, interfaces, and type aliases
- **Call/import/extends edges**: edges show CALLS, IMPORTS, EXTENDS, IMPLEMENTS, INSTANTIATES, and USES_TYPE relationships
- **Modules view**: alternate layout filtered to CALLS edges only
- **Stats tab**: treemap of symbols sized by inbound references
- **Selection sidebar**: click a node to see its callers, callees, and file context
- **Search & zoom-to-fit**: find a symbol and center the graph on it
- **Local-only analysis**: repo data is analyzed on your machine; nothing is uploaded

## Requirements

- **Node.js** (recommended: **20.x**; other versions may work but are not regularly tested)
- **npm** (comes with Node)
- **Git** installed and available in `PATH`
- A modern web browser

## Quick start

```bash
# Clone the repository
git clone git@github.com:dtanikella/git-explorer.git
cd git-explorer

# Install dependencies
# Note: plain `npm install` may fail because some @visx packages declare React 18
# peer deps while this app uses React 19. Use --legacy-peer-deps if needed.
npm install
# or: npm install --legacy-peer-deps

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> The `npm run dev` script uses nvm to switch to Node 20 if nvm is installed. You can also run `next dev` directly with your own Node setup.

## Using the app

1. **Enter a repository path**: type an absolute path to a local TypeScript repo (e.g. `/Users/you/projects/my-app`) and click **Analyze**.
2. **Browse the graph**: drag to pan, scroll to zoom, click a node to select it.
3. **Switch views**: use the view dropdown to choose **Internal Processing** (default) or **Modules**.
4. **Open the stats tab**: see a treemap of symbols sized by inbound references.
5. **Search**: type a symbol name and hit **Search** to zoom to it.

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server with Turbopack |
| `npm run build` | Create an optimized production build |
| `npm run start` | Start the production server (run `build` first) |
| `npm test` | Run all Jest tests |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run lint` | Run ESLint |

## Tech stack

- **Framework**: Next.js 16.1.6, React 19.2.3, TypeScript 5, App Router
- **Styling**: Tailwind CSS 4
- **Graph rendering**: D3 force simulation on an HTML5 canvas
- **Symbol indexing**: `@sourcegraph/scip-typescript` → `@c4312/scip` reader
- **Parsing**: `tree-sitter` + `tree-sitter-typescript` (native bindings)
- **Testing**: Jest + React Testing Library

## Project structure

```
git-explorer/
├── app/
│   ├── page.tsx                         # Main orchestrator UI
│   ├── layout.tsx                       # Root layout
│   ├── globals.css                      # Global styles / Tailwind
│   ├── api/
│   │   ├── repo-analysis/route.ts       # POST /api/repo-analysis
│   │   └── browse-directory/route.ts    # GET /api/browse-directory
│   ├── components/
│   │   ├── RepositorySelector.tsx       # Path input + directory picker
│   │   ├── repo-graph/RepoGraph.tsx     # Canvas force-directed graph
│   │   ├── selection/SelectionSidebar.tsx
│   │   ├── stats/StatsTreemap.tsx
│   │   ├── stats/StatsToolbar.tsx
│   │   ├── graph/GraphToolbar.tsx
│   │   └── TabSidebar.tsx
│   └── contexts/SelectionContext.tsx    # Selection state provider
├── app/services/analysis/
│   ├── controller.ts                    # analyzeRepo() entry point
│   ├── language-detector.ts             # Picks a language pipeline
│   └── ts/
│       ├── controller.ts                # TS pipeline orchestrator
│       ├── node-extractor.ts            # SCIP + tree-sitter → nodes
│       ├── edge-extractor.ts            # Edges between symbols
│       ├── graph-assembler.ts           # Packages result
│       └── symbol-utils.ts
├── lib/
│   ├── analysis/
│   │   ├── types.ts                     # AnalysisNode, AnalysisEdge, etc.
│   │   └── graph-config.ts              # RepoGraph config objects
│   ├── scip/                            # SCIP index reading/indexing
│   └── tree-sitter/                     # Thin tree-sitter wrappers
├── __tests__/                           # Jest test suites
└── docs/superpowers/                    # Design specs and implementation plans
```

## Analysis pipeline

```
User selects repo
    → POST /api/repo-analysis
    → analyzeRepo()
    → TypeScript pipeline (analyzeTsRepo)
        1. SCIP index  (lib/scip/ts/indexer.ts)
        2. tree-sitter parse  (lib/tree-sitter/*)
        3. node extraction  (node-extractor.ts)
        4. edge extraction  (edge-extractor.ts)
        5. graph assembly  (graph-assembler.ts)
    → RepoGraph.tsx renders canvas graph
```

## Troubleshooting

### `npm install` fails with peer dependency errors

Some `@visx` packages still declare React 18 peer deps. Run:

```bash
npm install --legacy-peer-deps
```

### `tree-sitter` build errors

`tree-sitter` and `@c4312/scip` include native bindings. If installation fails:

- Make sure you are on a supported Node version (20.x recommended).
- Make sure you have a C++ toolchain installed (Xcode Command Line Tools on macOS, `build-essential` on Ubuntu).
- Delete `node_modules` and `package-lock.json` and run `npm install --legacy-peer-deps` again.

### "No supported language detected"

The app currently looks for `tsconfig.json` to detect a TypeScript repo. Make sure the path you enter contains a `tsconfig.json`.

### Graph is empty

- Try disabling **Hide test files**.
- Check that the repo has non-trivial TypeScript code (the pipeline focuses on functions, classes, methods, and interfaces with cross-file references).

## Development notes

- Tests run with Jest. The default environment is `jsdom`; tree-sitter tests override this to `node` because tree-sitter uses native bindings.
- If tree-sitter tests fail when running the full suite but pass in isolation, it is a known test-isolation issue with the native parser in shared Jest workers. Run them separately with:
  ```bash
  npx jest __tests__/unit/tree-sitter __tests__/integration/tree-sitter.integration.test.ts __tests__/integration/analysis-controller.integration.test.ts __tests__/unit/node-extractor.test.ts __tests__/unit/edge-extractor.test.ts
  ```

## License

[Add your license here]
