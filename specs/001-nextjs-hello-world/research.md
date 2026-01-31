# Research: Next.js Hello World Boilerplate

**Feature**: 001-nextjs-hello-world  
**Date**: 2026-01-31  
**Purpose**: Resolve technical decisions and best practices before implementation

## Decisions Made

### 1. Package Manager

**Decision**: npm  
**Rationale**: User-specified preference. Standard, widely supported, no additional setup.  
**Alternatives considered**: yarn (faster installs), pnpm (disk efficient) — rejected per user choice.

### 2. Next.js Version

**Decision**: Latest (15.x as of 2026-01-31)  
**Rationale**: User requested latest. Next.js 15 includes App Router as default, improved performance.  
**Alternatives considered**: Next.js 14 (stable, more docs) — rejected per user preference for latest.

### 3. Styling Approach

**Decision**: Tailwind CSS  
**Rationale**: User confirmed. Rapid iteration, excellent Next.js integration, utility-first matches simplicity principle.  
**Alternatives considered**: CSS Modules (zero-config), styled-components (CSS-in-JS) — rejected per user choice.

### 4. Testing Framework

**Decision**: React Testing Library (with Jest as runner - bundled with create-next-app)  
**Rationale**: User requested React Testing Library for simple unit testing. Tests user behavior, not implementation details.  
**Alternatives considered**: Vitest (faster) — user chose simplicity over speed for now.

### 5. TypeScript Configuration

**Decision**: TypeScript with strict mode  
**Rationale**: Constitution specifies "TypeScript strict mode preferred". Default with create-next-app.  
**Alternatives considered**: None — constitution requirement.

### 6. Project Initialization Method

**Decision**: `npx create-next-app@latest` with flags  
**Rationale**: Official scaffolding tool, includes Tailwind option, sets up TypeScript, minimal manual config.  
**Alternatives considered**: Manual setup — violates simplicity principle, more error-prone.

## Best Practices Research

### Next.js 15 App Router Structure

```
app/
├── layout.tsx      # Root layout (required)
├── page.tsx        # Homepage (/)
├── globals.css     # Global styles (Tailwind directives)
└── favicon.ico     # Site icon
```

- App Router is the default in Next.js 15
- `layout.tsx` wraps all pages, handles metadata
- `page.tsx` is the route component

### Testing Setup for Next.js

Jest comes pre-configured with create-next-app when using `--example with-jest` or manual setup:
- `jest.config.js` - Jest configuration
- `jest.setup.js` - Testing Library setup
- Tests in `__tests__/` directory or `*.test.tsx` files

### Tailwind CSS Integration

Included with create-next-app via `--tailwind` flag:
- `tailwind.config.ts` - Tailwind configuration
- `postcss.config.mjs` - PostCSS configuration
- Directives in `globals.css`

## Open Questions

None — all technical decisions resolved.

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Tailwind CSS + Next.js](https://tailwindcss.com/docs/guides/nextjs)
