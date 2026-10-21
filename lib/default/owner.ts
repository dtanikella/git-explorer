/** Characters of an unquoted SCIP descriptor name. */
const NAME_CHAR = /[A-Za-z0-9_+\-$<>]/;

/**
 * Where each descriptor of a SCIP symbol ends, as indexes into the symbol string.
 *
 * @remarks
 * Follows the SCIP descriptor grammar: a name (plain or backtick-quoted, with a doubled backtick as the escape)
 * followed by a suffix: `/` namespace, `#` type, `.` term, `!` macro, `:` meta, `(disambiguator).` method, or
 * `[name]` type parameter. The four-token package header is skipped first. Returns `null` for a symbol that does
 * not parse, such as a `local` symbol.
 */
function descriptorEnds(symbol: string): number[] | null {
  let i = 0;
  for (let spaces = 0; spaces < 4; i++) {
    if (i >= symbol.length) return null;
    if (symbol[i] === ' ') {
      if (symbol[i + 1] === ' ') i++; // an escaped space inside a header token
      else spaces++;
    }
  }
  const ends: number[] = [];
  while (i < symbol.length) {
    if (symbol[i] === '`') {
      i++;
      for (; i < symbol.length; i++) {
        if (symbol[i] !== '`') continue;
        if (symbol[i + 1] === '`') i++;
        else break;
      }
      if (i >= symbol.length) return null;
      i++;
    } else {
      const start = i;
      while (i < symbol.length && NAME_CHAR.test(symbol[i])) i++;
      if (i === start && symbol[i] !== '(' && symbol[i] !== '[') return null;
    }
    const c = symbol[i];
    if (c === '(') {
      const close = symbol.indexOf(')', i);
      if (close < 0 || symbol[close + 1] !== '.') return null;
      i = close + 2;
    } else if (c === '[') {
      const close = symbol.indexOf(']', i);
      if (close < 0) return null;
      i = close + 1;
    } else if (c === '/' || c === '#' || c === '.' || c === '!' || c === ':') {
      i++;
    } else {
      return null;
    }
    ends.push(i);
  }
  return ends;
}

/**
 * The symbol that owns a member, derived from the member's SCIP `symbol` string.
 *
 * @remarks
 * The owner is the symbol with its last descriptor removed, so `…/types.ts/AnalysisError#<constructor>().` belongs
 * to `…/types.ts/AnalysisError#`. A symbol whose parent is a file or namespace (`/`) is top-level and has no
 * owner. `SymbolInformation.enclosing_symbol` is empty for non-local symbols, so the string is the only source. Only the
 * TypeScript grammar has been checked.
 *
 * @param symbol - A SCIP symbol string.
 * @returns The owning symbol, or `null` for a top-level or unparseable symbol.
 */
export function ownerOf(symbol: string): string | null {
  const ends = descriptorEnds(symbol);
  if (!ends || ends.length < 2) return null;
  const parentEnd = ends[ends.length - 2];
  const suffix = symbol[parentEnd - 1];
  return suffix === '#' || suffix === '.' ? symbol.slice(0, parentEnd) : null;
}
