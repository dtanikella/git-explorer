const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /(^|[\\/])__tests__[\\/]/,
  /(^|[\\/])tests?[\\/]/,
];

/**
 * Checks whether a file path matches common test file patterns.
 *
 * @remarks
 * Matches `*.test.*`, `*.spec.*`, files under `__tests__/` or `tests/`
 * directories. Used by the analysis pipeline to exclude test files from
 * certain graph rendering decisions (e.g., sizing by call frequency).
 *
 * @param filePath - The file path to check (relative or absolute).
 * @returns `true` when the path matches any test file pattern.
 * @see commit 84866f0
 */
export function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some(pattern => pattern.test(filePath));
}
