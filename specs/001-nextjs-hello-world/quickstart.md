# Quickstart: Next.js Hello World Boilerplate

**Feature**: 001-nextjs-hello-world  
**Date**: 2026-01-31

## Prerequisites

- **Node.js**: v18.18.0 or higher (required for Next.js 15)
- **npm**: v9+ (comes with Node.js)
- **Git**: For version control

Verify your setup:
```bash
node --version  # Should be >= 18.18.0
npm --version   # Should be >= 9
```

## Quick Setup

### 1. Clone and Install

```bash
git clone https://github.com/dtanikella/git-explorer.git
cd git-explorer
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. View Application

Open [http://localhost:3000](http://localhost:3000) in your browser.

You should see: **"Hello World"**

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint checks |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
git-explorer/
├── app/
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Homepage (Hello World)
│   └── globals.css      # Global styles (Tailwind)
├── __tests__/
│   └── page.test.tsx    # Homepage tests
├── public/              # Static assets
├── package.json         # Dependencies & scripts
├── tsconfig.json        # TypeScript config
├── tailwind.config.ts   # Tailwind config
├── next.config.ts       # Next.js config
└── README.md            # Project documentation
```

## Development Workflow

Following the [constitution's TDD principle](../../.specify/memory/constitution.md):

1. **Write test** for new functionality
2. **Run test** — verify it fails (red)
3. **Implement** minimal code to pass
4. **Run test** — verify it passes (green)
5. **Refactor** if needed
6. **Commit** with clear message

## Troubleshooting

### Port 3000 in use

Next.js will automatically try port 3001. Or kill the process:
```bash
lsof -ti:3000 | xargs kill -9
```

### Node version mismatch

Use nvm to switch versions:
```bash
nvm install 18
nvm use 18
```

### Dependencies won't install

Clear npm cache and retry:
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```
