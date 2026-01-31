# Contracts: Next.js Hello World Boilerplate

**Feature**: 001-nextjs-hello-world  
**Date**: 2026-01-31

## Overview

This boilerplate feature has minimal API contracts. The primary "contract" is the component interface for the homepage.

## Component Contracts

### Homepage Component (`app/page.tsx`)

**Type**: React Server Component (default in Next.js 15 App Router)

```typescript
// Contract: The homepage must export a default function component
export default function Home(): JSX.Element

// Rendering contract:
// - MUST render text containing "Hello World"
// - MUST be accessible (semantic HTML)
```

### Root Layout (`app/layout.tsx`)

```typescript
// Contract: Root layout wraps all pages
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}): JSX.Element

// Metadata contract:
export const metadata: Metadata = {
  title: string,        // Required: "Git Explorer" or similar
  description: string,  // Required: App description
}
```

## HTTP Contracts

### GET /

| Property | Value |
|----------|-------|
| Method | GET |
| Path | `/` |
| Response | HTML page containing "Hello World" |
| Status | 200 OK |

## Test Contracts

Tests verify the following assertions:

| Contract | Test Assertion |
|----------|----------------|
| Homepage renders | `page.tsx` default export renders without error |
| Hello World visible | Screen contains text matching "Hello World" |
| Title set | Document title matches expected value |

## Future Contracts

As git-explorer grows, this directory will contain:
- API route schemas (OpenAPI/JSON Schema)
- Component prop interfaces
- Data fetching contracts
