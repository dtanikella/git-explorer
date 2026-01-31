# Implementation Plan: Next.js Hello World Boilerplate

**Branch**: `001-nextjs-hello-world` | **Date**: 2026-01-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-nextjs-hello-world/spec.md`

## Summary

Create a minimal Next.js boilerplate application that displays "Hello World" and can be run locally on localhost:3000. Uses latest Next.js with TypeScript, Tailwind CSS for styling, and React Testing Library for unit tests. Follows TDD principles with tests written before implementation.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Framework**: Next.js 15.x (latest, App Router)  
**Primary Dependencies**: React 19.x, Tailwind CSS 3.x, React Testing Library  
**Package Manager**: npm  
**Storage**: N/A (no data persistence for this feature)  
**Testing**: Jest + React Testing Library  
**Target Platform**: Web (localhost development, Node.js 18.18+)  
**Project Type**: Web application (single Next.js project)  
**Performance Goals**: Page load under 2 seconds (SC-002 from spec)  
**Constraints**: Clone-to-running under 3 minutes (SC-001 from spec)  
**Scale/Scope**: Single page, minimal boilerplate

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | PASS | Tests defined in contracts, test tasks ordered BEFORE implementation |
| II. Simplicity and YAGNI | PASS | Minimal dependencies, single page, no over-engineering |
| III. Data Integrity | N/A | No git operations in this feature |
| IV. User Experience First | PASS | Simple, clear Hello World with obvious UX |
| V. Incremental Evolution | PASS | Small working increment, foundation for future features |

**Gate Result**: PASS - Proceed with implementation

## Project Structure

### Documentation (this feature)

```
specs/001-nextjs-hello-world/
  plan.md              # This file
  spec.md              # Feature specification
  research.md          # Phase 0: Technical decisions
  data-model.md        # Phase 1: Entity definitions
  quickstart.md        # Phase 1: Developer guide
  contracts/           # Phase 1: Component/API contracts
    README.md
  checklists/
    requirements.md    # Spec quality checklist
  tasks.md             # Phase 2: Implementation tasks (via /speckit.tasks)
```

### Source Code (repository root)

```
git-explorer/
  app/
    layout.tsx         # Root layout (metadata, fonts, HTML structure)
    page.tsx           # Homepage component (Hello World)
    globals.css        # Tailwind CSS directives + global styles
    favicon.ico        # Site icon
  __tests__/
    page.test.tsx      # Homepage unit tests
  public/              # Static assets
  package.json         # Dependencies, scripts
  tsconfig.json        # TypeScript configuration (strict mode)
  next.config.ts       # Next.js configuration
  tailwind.config.ts   # Tailwind CSS configuration
  postcss.config.mjs   # PostCSS configuration
  jest.config.js       # Jest configuration
  jest.setup.js        # Testing Library setup
  README.md            # Project documentation (updated)
```

**Structure Decision**: Single Next.js web application using App Router. Test files in __tests__ directory following Jest conventions.

## Implementation Approach

### Phase 0: Research (Complete)

See [research.md](./research.md) for resolved technical decisions:
- npm as package manager
- Next.js 15.x (latest)
- Tailwind CSS for styling
- React Testing Library + Jest for testing
- TypeScript strict mode

### Phase 1: Design (Complete)

See generated artifacts:
- [data-model.md](./data-model.md) - Component structure
- [contracts/README.md](./contracts/README.md) - Component contracts
- [quickstart.md](./quickstart.md) - Developer guide

### Phase 2: Task Generation

Run `/speckit.tasks` to generate implementation tasks with TDD ordering:
1. Test tasks FIRST (write failing tests)
2. Implementation tasks SECOND (make tests pass)
3. Documentation tasks LAST (update README)

## Key Implementation Notes

### create-next-app Command

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Flags:
- --typescript: Enable TypeScript
- --tailwind: Include Tailwind CSS
- --eslint: Include ESLint
- --app: Use App Router (default in Next.js 15)
- --src-dir=false: Put app/ at root (simpler structure)
- --import-alias: Standard import alias
- --use-npm: Use npm as package manager

### Testing Setup

Jest and React Testing Library require manual setup after create-next-app:

```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom
```

### TDD Workflow

Per constitution Principle I:
1. Write test for Hello World renders - test fails (red)
2. Implement page.tsx with Hello World - test passes (green)
3. Refactor if needed - tests stay green
4. Commit

## Complexity Tracking

No violations - plan adheres to all constitution principles.

| Principle | Complexity Added | Justification |
|-----------|------------------|---------------|
| None | N/A | Plan uses minimal dependencies and simplest possible structure |

## Next Steps

1. Run `/speckit.tasks` to generate ordered task list
2. Execute tasks following TDD workflow
3. Verify all acceptance criteria from spec are met
