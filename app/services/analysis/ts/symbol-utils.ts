/**
 * Qualifies SCIP symbols to be globally unique.
 *
 * - Empty/whitespace symbols → null (skip the node/edge)
 * - Local symbols (e.g. "local 3") → "filePath#local 3" (file-scoped uniqueness)
 * - Global symbols → returned unchanged (already unique)
 */
export function qualifySymbol(filePath: string, symbol: string): string | null {
  if (!symbol || !symbol.trim()) return null;
  if (symbol.startsWith('local ')) return `${filePath}#${symbol}`;
  return symbol;
}
