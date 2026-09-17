// Build/tooling output that can end up in tsconfig's `include` (e.g. Next.js's
// auto-managed `.next/types` and `.next/dev/types` typed-route declarations)
// but isn't project source and shouldn't be analyzed.
const GENERATED_DIR_PATTERNS = [
  /(^|[\\/])\.next[\\/]/,
];

export function isGeneratedFile(filePath: string): boolean {
  return GENERATED_DIR_PATTERNS.some(pattern => pattern.test(filePath));
}
