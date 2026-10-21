# "How Excalidraw Works" — 5-Minute Git Explorer Walkthrough

A live-demo script using Git Explorer against `external/excalidraw` (already cloned at
`/Users/dtanikella/Documents/Projects/git-explorer/external/excalidraw`, ignored by this repo's `.gitignore`).

## Before you present (do this ahead of time — not live)

Excalidraw is a large monorepo. The first analysis of it is CPU-bound (tree-sitter parsing
thousands of files) and took several minutes in testing. **Pre-warm both views before your talk**
so you're not staring at a spinner in front of an audience:

```bash
npm run dev
```

1. Open `http://localhost:3000`, enter the repo path below, click **Analyze**, and let it finish once.
   This builds the on-disk SCIP cache (`external/excalidraw/.git-explorer/`), which makes the next
   load much faster.
   ```
   /Users/dtanikella/Documents/Projects/git-explorer/external/excalidraw
   ```
2. Switch the **View** dropdown (Graph tab) to **Vanilla (directory)** once, so the force layout
   settles and gets cached in your browser tab state.
3. Go to the **Diff** tab, set **base: v0.18.0**, **compare: v0.18.1** (see note below on ordering),
   and let it finish once. Leave the dev server + browser tab open and don't reload before you present
   — the diff/graph state lives in React state and resets on refresh.

**Ordering gotcha:** the base/compare pickers disable themselves while a diff is loading, and
changing the *base* alone re-diffs against whatever *compare* currently is (e.g. `master`), which is
expensive. Set **compare** to `v0.18.1` first, *then* set **base** to `v0.18.0`, so you never trigger an
accidental full-branch diff.

---

## Part 1 — Codebase tour via the directory graph (~2.5 min)

**Setup:** Graph tab → View: **Vanilla (directory)** → Hide test files: on.

**Talking points:**

- "This is Git Explorer's symbol graph — every dot is a function, class, method, or interface
  pulled from a real SCIP index and tree-sitter parse, not a toy AST walk."
- "The 'Vanilla (directory)' view adds invisible per-folder and per-file hubs that pull symbols
  toward their file, files toward their folder, and folders toward their parent — so the physics
  of the force layout mirrors the actual directory tree. Zoom out and you get a codebase map for free."
- Zoom/scroll out until you see the whole canvas: distinct colored clusters emerge — this is
  `packages/excalidraw/` (the core library: canvas rendering, elements, actions, components) versus
  `packages/*` siblings (math, common, utils) versus `excalidraw-app/` (the hosted web app shell).
- Hover/click a cluster label (e.g. a file chip like `App.tsx`) to call out that **`App.tsx`** is
  the single largest file — it's the root React component orchestrating the whole canvas, and its
  size alone tells a story about where complexity concentrates.
- Use the **Search & Select** sidebar (left) to jump to a known symbol — e.g. search `ExcalidrawElement`
  or `App` — and point out the selection sidebar shows callers/callees, reinforcing "this view isn't
  just pretty, it's navigable."

**One-liner to close this part:** "So structurally: a core drawing-engine package, a thin app shell
around it, and a handful of focused utility packages — all visible without reading a README."

---

## Part 2 — What changed between v0.18.0 → v0.18.1 (~2 min)

**Why this pair:** it's a real, tiny, *meaningful* patch release — a single commit
(`a2ec2889`, "fix: backport mermaid xss fix to 0.18.1") — perfect for a live demo because it's fast
to diff and has a clear story, unlike diffing against a long-lived branch.

**Setup:** Diff tab → base: `v0.18.0`, compare: `v0.18.1` (pre-staged per above).

**Talking points:**

- "The Diff tab reuses the same directory-clustered graph, but now nodes are colored by diff status:
  green = added, blue = modified, red = deleted — and difftastic (a structural, AST-aware diff tool)
  is what detects the changes, not naive line diffing."
- Point at the status bar: it'll read something like "✓ 2 TS files changed" with counts.
- Call out the two touched files, both inside `packages/excalidraw/components/`:
  - **`TTDDialog/common.ts`** — the "Text to Diagram" dialog's Mermaid-import path
  - **`App.tsx`** — the same destructuring pattern, inline in the app's drag-and-drop/paste handler
- "Both changes are the same one-line defensive fix: `const { elements, files } = ret;` becomes
  `const { elements, files = {} } = ret;` — guarding against `files` being `undefined` when
  Mermaid diagrams are converted to Excalidraw elements. That's the XSS backport: a missing default
  let downstream code treat `undefined` as an object users could shape adversarially."
- "Notice how small and surgical this is — a patch release, not a feature bump, and the directory
  view shows exactly that: two highlighted nodes in the same neighborhood of the graph, everything
  else dimmed/unchanged."

**One-liner to close:** "This is the value prop: structural diffs mapped onto the real codebase
topology, so a two-line security fix is immediately visible in context, not buried in a 900-line
`yarn.lock` diff."

---

## Quick reference

| Step | Where | Value |
|---|---|---|
| Repo path | Repository Path field | `/Users/dtanikella/Documents/Projects/git-explorer/external/excalidraw` |
| Part 1 view | Graph tab → View dropdown | `Vanilla (directory)` |
| Part 2 base ref | Diff tab → base picker | `v0.18.0` |
| Part 2 compare ref | Diff tab → compare picker | `v0.18.1` |
| Expected diff result | Status line | "✓ 2 TS files changed" |
| Changed files | — | `packages/excalidraw/components/App.tsx`, `packages/excalidraw/components/TTDDialog/common.ts` |
