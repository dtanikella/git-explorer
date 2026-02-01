
# Git Explorer

A Next.js web application that visualizes git repository commit activity through interactive treemap charts. Analyze which files and directories have been most active in your codebase over different time periods.

## Features

- **Interactive Treemap Visualization**: View commit frequency across your repository files using hierarchical treemaps
- **Color-Coded Activity**: Files are colored from dark green (high activity) to light gray (low activity) based on recent commit frequency
- **Multiple Time Ranges**: Analyze commits from the last 2 weeks, 1 month, 3 months, 6 months, or 1 year
- **Repository Analysis**: Input any local git repository path for instant analysis
- **Performance Optimized**: Handles repositories with thousands of files efficiently
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Clear feedback for invalid repositories, missing git, or empty time ranges

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Git installed and available in PATH
- Modern web browser (Chrome 86+, Edge 86+, Safari 15.2+, Firefox 111+)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd git-explorer

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Usage

1. **Enter Repository Path**: Provide an absolute path to a local git repository (e.g., `/Users/username/projects/my-repo`)

2. **Select Time Range**: Choose from predefined ranges:
   - Last 2 weeks
   - Last month
   - Last 3 months
   - Last 6 months
   - Last year

3. **Analyze**: Click "Analyze Repository" to generate the treemap

4. **Explore**: Hover over rectangles to see file/folder details, click to navigate the hierarchy

## How It Works

### Treemap Visualization

The treemap displays your repository as nested rectangles where:
- **Size**: Represents total commit count (larger = more commits)
- **Color**: Represents recent activity (darker green = more recent commits)
- **Hierarchy**: Folders contain files and subfolders
- **Top 500 Files**: Shows the most active files, sorted by commit frequency

### Analysis Process

1. **Git Log Extraction**: Uses `git log --name-only --since=<date>` to get commit data
2. **File Counting**: Counts unique commits per file within the selected time range
3. **Frequency Scoring**: Calculates recent activity scores (0-1 scale)
4. **Tree Building**: Constructs hierarchical tree structure from file paths
5. **Color Mapping**: Applies gradient colors based on activity scores
6. **Visualization**: Renders interactive treemap using D3.js (via Visx)

## Architecture

### Tech Stack

- **Frontend**: Next.js 16.1.6 with App Router, React 19.2.3, TypeScript 5
- **Styling**: Tailwind CSS 4 for responsive design
- **Visualization**: Visx (@visx/hierarchy) for D3-powered treemaps
- **Git Integration**: simple-git library for repository analysis
- **Testing**: Jest with React Testing Library
- **Build**: Next.js with Turbopack for fast development

### Project Structure

```
git-explorer/
├── app/
│   ├── page.tsx                 # Main UI with treemap display
│   ├── layout.tsx              # Root layout
│   ├── globals.css             # Global styles and Tailwind
│   ├── api/git-analysis/       # API endpoint for git analysis
│   └── components/             # React components
│       ├── RepositorySelector.tsx
│       ├── TreemapChart.tsx
│       ├── LoadingState.tsx
│       └── DateRangeSelector.tsx
├── lib/
│   ├── git/                    # Git analysis logic
│   │   ├── analyzer.ts         # Git log parsing and commit counting
│   │   ├── tree-builder.ts     # Hierarchical tree construction
│   │   └── types.ts            # TypeScript interfaces
│   ├── treemap/                # Visualization utilities
│   │   ├── color-scale.ts      # Activity-based color mapping
│   │   └── data-transformer.ts # Data transformation for Visx
│   └── utils/                  # Helper utilities
│       └── date-helpers.ts     # Time range calculations
├── __tests__/                  # Test suites
│   ├── unit/                   # Unit tests
│   ├── integration/            # API integration tests
│   └── components/             # Component tests
└── specs/002-commit-treemap/   # Feature documentation
    ├── spec.md                 # Feature specification
    ├── plan.md                 # Implementation plan
    ├── quickstart.md           # Developer setup guide
    └── tasks.md                # Task breakdown
```

## Development

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Build for production
npm run build
```

### Development Workflow

This project follows Test-Driven Development (TDD):

1. **Write failing test** for new functionality
2. **Implement code** to make test pass
3. **Refactor** while maintaining test coverage
4. **Repeat** for each feature increment

### Contributing

See [specs/002-commit-treemap/quickstart.md](specs/002-commit-treemap/quickstart.md) for detailed development setup and contribution guidelines.

## Performance

- **Analysis Time**: <10 seconds for repositories with 10,000+ files
- **Memory Usage**: Efficient streaming of git log output
- **Visualization**: Smooth interaction with up to 500 displayed files
- **Responsiveness**: Adapts to window size changes automatically

## Troubleshooting

### Common Issues

**"Git is required" error**
- Ensure git is installed and available in your PATH
- On macOS: `brew install git`
- On Ubuntu: `sudo apt install git`

**"Repository path does not exist"**
- Use absolute paths (e.g., `/Users/username/projects/repo`)
- Ensure you have read access to the directory

**Empty treemap**
- Check if the repository has commits in the selected time range
- Try a longer time range or verify recent activity with `git log --oneline -10`

**Slow analysis**
- Large repositories may take longer to analyze
- The app processes git history efficiently but very large repos (>100k files) may be slow

## License

[Add your license here]

## Contributing

Contributions welcome! Please read our [development guide](specs/002-commit-treemap/quickstart.md) and follow the TDD workflow.
