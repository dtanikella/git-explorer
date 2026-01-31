// Color palette for file extension visualization

export const EXTENSION_COLORS: Record<string, string> = {
  // TypeScript
  '.ts': '#3178c6',
  '.tsx': '#3178c6',

  // JavaScript
  '.js': '#f7df1e',
  '.jsx': '#f7df1e',

  // Styles
  '.css': '#663399',
  '.scss': '#663399',

  // Data/Config
  '.json': '#f5a623',

  // Documentation
  '.md': '#00d4aa',

  // HTML
  '.html': '#e34c26',

  // YAML
  '.yml': '#cb171e',
  '.yaml': '#cb171e',

  // Python
  '.py': '#3572a5',

  // Ruby
  '.rb': '#cc342d',

  // Go
  '.go': '#00add8',

  // Rust
  '.rs': '#dea584',
};

// Default colors
export const DEFAULT_FILE_COLOR = '#8b8b8b'; // Gray for unknown extensions
export const FOLDER_COLOR = '#e0e0e0'; // Light gray for folders