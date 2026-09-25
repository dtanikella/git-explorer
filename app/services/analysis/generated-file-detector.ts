// Build/tooling output that can end up in tsconfig's `include` (e.g. Next.js's
// auto-managed `.next/types` and `.next/dev/types` typed-route declarations)
// but isn't project source and shouldn't be analyzed.
const GENERATED_DIR_PATTERNS = [
  /(^|[\\/])\.next[\\/]/,
];

/**
 * Checks whether a file path matches known generated/build output directories
 * that should be excluded from analysis.
 *
 * @remarks
 * Matches paths under `.next/` (Next.js auto-managed typed-route declarations
 * that can end up in tsconfig's `include`). These are not project source and
 * would produce misleading analysis results.
 *
 * @param filePath - The file path to check (relative or absolute).
 * @returns `true` when the path matches a generated directory pattern.
 * @see PR #38
 */
export function isGeneratedFile(filePath: string): boolean {
  return GENERATED_DIR_PATTERNS.some(pattern => pattern.test(filePath));
}
