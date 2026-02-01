/**
 * Color palette for file type visualization
 */
export const FILE_TYPE_COLORS = {
  RUBY: '#E0115F',      // Ruby red for .rb files
  TYPESCRIPT_REACT: '#ADD8E6',  // Light blue for .tsx files
  DEFAULT: '#808080'    // Gray for test files and others
} as const;

/**
 * Regex patterns for identifying test files
 */
export const TEST_PATTERNS = [
  /(?:^|\/)__tests__\//,
  /(?:^|\/)tests?\//,
  /\.test\./,
  /\.spec\./
] as const;

/**
 * Determines the color for a file based on its path and extension.
 *
 * Priority order:
 * 1. Test files (any path matching test patterns) → gray
 * 2. .rb files → ruby red
 * 3. .tsx files → light blue
 * 4. All other files → gray
 *
 * @param filePath - Full file path from repository root
 * @returns Hex color code
 *
 * @example
 * getFileTypeColor('app.rb') // '#E0115F'
 * getFileTypeColor('components/Button.tsx') // '#ADD8E6'
 * getFileTypeColor('Button.test.tsx') // '#808080' (test takes precedence)
 * getFileTypeColor('src/utils/helper.ts') // '#808080'
 */
export function getFileTypeColor(filePath: string): string {
  // Check for test patterns first (highest priority)
  if (TEST_PATTERNS.some(pattern => pattern.test(filePath))) {
    return FILE_TYPE_COLORS.DEFAULT;
  }

  // Check file extensions
  if (filePath.endsWith('.rb')) {
    return FILE_TYPE_COLORS.RUBY;
  }

  if (filePath.endsWith('.tsx')) {
    return FILE_TYPE_COLORS.TYPESCRIPT_REACT;
  }

  // Default for all other files
  return FILE_TYPE_COLORS.DEFAULT;
}