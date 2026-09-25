import { Buffer } from 'buffer';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import type { NodeWrapper } from '@/lib/tree-sitter/node';
import { SyntaxType } from '@/lib/analysis/types';
import type { DiffUnit, MappedSpan, Pos } from './types';
import type { DifftasticFileResult } from './difftastic';

// ============================================================================
// Types replicated from node-extractor logic
// ============================================================================

const DECLARATION_TYPES: Record<string, SyntaxType> = {
  function_declaration: SyntaxType.FUNCTION,
  method_definition: SyntaxType.METHOD,
  class_declaration: SyntaxType.CLASS,
  interface_declaration: SyntaxType.INTERFACE,
  type_alias_declaration: SyntaxType.TYPE_ALIAS,
  enum_declaration: SyntaxType.ENUM,
  internal_module: SyntaxType.NAMESPACE,
};

const METHOD_LIKE_TYPES = new Set<SyntaxType>([
  SyntaxType.FUNCTION,
  SyntaxType.METHOD,
  SyntaxType.GETTER,
  SyntaxType.SETTER,
  SyntaxType.CONSTRUCTOR,
]);

function classifyMethodDefinition(declNode: NodeWrapper, name: string): SyntaxType {
  if (name === 'constructor') return SyntaxType.CONSTRUCTOR;
  for (const child of declNode.children) {
    if (child.type === 'get') return SyntaxType.GETTER;
    if (child.type === 'set') return SyntaxType.SETTER;
  }
  return SyntaxType.METHOD;
}

function getIdentifierName(node: NodeWrapper): string | null {
  const nameChild = node.childForFieldName('name');
  return nameChild ? nameChild.text : null;
}

/** Find the declaration node for range computation: the declaration itself, widened to export_statement. */
function getRangeNode(node: NodeWrapper): NodeWrapper {
  const parent = node.parent;
  if (parent?.type === 'export_statement') return parent;
  return node;
}

function isFunctionLike(kind: SyntaxType): boolean {
  return METHOD_LIKE_TYPES.has(kind);
}

/**
 * Get the declaration node for a variable_declarator:
 * use its lexical_declaration or variable_declaration parent when that holds exactly one declarator,
 * otherwise the declarator itself. Widened to export_statement.
 */
function getVariableRangeNode(varNode: NodeWrapper): NodeWrapper {
  const parent = varNode.parent;
  if (parent && (parent.type === 'lexical_declaration' || parent.type === 'variable_declaration')) {
    if (parent.namedChildren.length === 1) {
      const grandParent = parent.parent;
      if (grandParent?.type === 'export_statement') return grandParent;
      return parent;
    }
  }
  const grandParent = varNode.parent?.parent;
  if (grandParent?.type === 'export_statement') return grandParent;
  return varNode;
}

// ============================================================================
// extractUnits
// ============================================================================

/**
 * List the diff units of one parsed file.
 * @param tree parsed tree of one side
 * @param path repo-relative file path
 * @param side which commit the tree belongs to
 * @returns units in source order, with parentIndex and absorbedBy filled
 */
export function extractUnits(
  tree: TreeWrapper,
  path: string,
  side: 'old' | 'new',
): DiffUnit[] {
  const units: UnitInfo[] = [];
  const root = tree.rootNode;

  // 1. Collect declaration nodes (same as node-extractor, excluding decorators)
  const declarationTypes = Object.keys(DECLARATION_TYPES);
  const allDeclarations = root.descendantsOfType(declarationTypes);

  for (const declNode of allDeclarations) {
    const mappedType = DECLARATION_TYPES[declNode.type];
    if (!mappedType) continue;

    const name = getIdentifierName(declNode);
    if (!name) continue;

    const syntaxType = declNode.type === 'method_definition'
      ? classifyMethodDefinition(declNode, name)
      : mappedType;

    const nameNode = declNode.childForFieldName('name');
    if (!nameNode) continue;

    const rangeNode = getRangeNode(declNode);

    units.push({
      node: declNode,
      name,
      kind: syntaxType,
      namePos: { row: nameNode.startPosition.row, column: nameNode.startPosition.column },
      start: { row: rangeNode.startPosition.row, column: rangeNode.startPosition.column },
      end: { row: rangeNode.endPosition.row, column: rangeNode.endPosition.column },
    });
  }

  // 2. Arrow-function variable declarators
  const arrowFunctions = root.descendantsOfType(['arrow_function']);
  for (const arrowNode of arrowFunctions) {
    const parent = arrowNode.parent;
    if (!parent || parent.type !== 'variable_declarator') continue;

    const nameNode = parent.childForFieldName('name');
    if (!nameNode) continue;

    const name = nameNode.text;
    const rangeNode = getVariableRangeNode(parent);

    units.push({
      node: parent,
      name,
      kind: SyntaxType.FUNCTION,
      namePos: { row: nameNode.startPosition.row, column: nameNode.startPosition.column },
      start: { row: rangeNode.startPosition.row, column: rangeNode.startPosition.column },
      end: { row: rangeNode.endPosition.row, column: rangeNode.endPosition.column },
    });
  }

  // 3. Plain variable/constant declarations (non-arrow-function)
  const variableDeclarators = root.descendantsOfType(['variable_declarator']);
  for (const varNode of variableDeclarators) {
    const valueNode = varNode.childForFieldName('value');
    if (valueNode?.type === 'arrow_function') continue;

    const nameNode = varNode.childForFieldName('name');
    if (!nameNode || nameNode.type !== 'identifier') continue;

    const name = nameNode.text;
    const rangeNode = getVariableRangeNode(varNode);

    units.push({
      node: varNode,
      name,
      kind: SyntaxType.VARIABLE,
      namePos: { row: nameNode.startPosition.row, column: nameNode.startPosition.column },
      start: { row: rangeNode.startPosition.row, column: rangeNode.startPosition.column },
      end: { row: rangeNode.endPosition.row, column: rangeNode.endPosition.column },
    });
  }

  // 4. Sort by source position
  units.sort((a, b) => {
    if (a.namePos.row !== b.namePos.row) return a.namePos.row - b.namePos.row;
    return a.namePos.column - b.namePos.column;
  });

  // 5. Build qualified names, parentIndex, absorbedBy
  return assignRelationships(units, path, side);
}

interface UnitInfo {
  node: NodeWrapper;
  name: string;
  kind: SyntaxType;
  namePos: Pos;
  start: Pos;
  end: Pos;
}

function assignRelationships(
  units: UnitInfo[],
  path: string,
  side: 'old' | 'new',
): DiffUnit[] {
  const result: DiffUnit[] = [];

  // First pass: determine absorption
  // A unit is absorbed by the nearest enclosing function-like unit whose body contains it
  const functionLikeIndexes: number[] = [];

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    let absorbedBy: number | null = null;

    // Check if this unit sits inside another function-like unit's body
    for (const fi of functionLikeIndexes) {
      const enclosing = units[fi];
      if (
        u.namePos.row > enclosing.start.row ||
        (u.namePos.row === enclosing.start.row && u.namePos.column >= enclosing.start.column)
      ) {
        // Check if it's inside the function body (not the function itself)
        // The function name should not absorb itself
        if (fi !== i) {
          // Simple heuristic: a unit whose start is after the enclosing unit's start and before its end
          // and whose kind is different from the enclosing kind
          if (
            (u.start.row > enclosing.start.row ||
             (u.start.row === enclosing.start.row && u.start.column >= enclosing.start.column)) &&
            (u.start.row < enclosing.end.row ||
             (u.start.row === enclosing.end.row && u.start.column < enclosing.end.column))
          ) {
            absorbedBy = fi;
            break;
          }
        }
      }
    }

    if (isFunctionLike(u.kind)) {
      functionLikeIndexes.push(i);
    }

    result.push({
      side,
      path,
      index: i,
      kind: u.kind,
      name: u.name,
      qualifiedName: '', // filled below
      namePos: u.namePos,
      start: u.start,
      end: u.end,
      parentIndex: null, // filled below
      absorbedBy,
    });
  }

  // Second pass: compute parentIndex (nearest enclosing non-absorbed unit)
  for (let i = 0; i < result.length; i++) {
    let parentIndex: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (result[j].absorbedBy !== null) continue; // skip absorbed units as parents
      const parent = result[j];
      if (
        (result[i].start.row > parent.start.row ||
         (result[i].start.row === parent.start.row && result[i].start.column >= parent.start.column)) &&
        (result[i].start.row < parent.end.row ||
         (result[i].start.row === parent.end.row && result[i].start.column < parent.end.column)) &&
        i !== j
      ) {
        parentIndex = j;
        break;
      }
    }
    result[i].parentIndex = parentIndex;
  }

  // Third pass: compute qualified names
  for (let i = 0; i < result.length; i++) {
    const u = result[i];
    // For qualifiedName, use parent (non-absorbed) chain
    const names: string[] = [u.name];
    let pIdx = u.parentIndex;
    while (pIdx !== null && result[pIdx].absorbedBy === null) {
      names.unshift(result[pIdx].name);
      pIdx = result[pIdx].parentIndex;
    }
    u.qualifiedName = names.join('.');
  }

  return result;
}

// ============================================================================
// Byte column conversion
// ============================================================================

/**
 * Convert a UTF-8 byte offset on a line to a UTF-16 code unit column.
 * This is needed because tree-sitter reports columns in UTF-16 code units
 * while difftastic reports columns in UTF-8 byte offsets.
 */
export function byteColToUtf16(line: string, byteCol: number): number {
  const bytes = Buffer.from(line, 'utf8').subarray(0, byteCol);
  return bytes.toString('utf8').length;
}

// ============================================================================
// mapSpans
// ============================================================================

/**
 * Resolve difftastic spans (lhs to old units, rhs to new units), converting byte columns to UTF-16 first.
 * A span belongs to unit U when U.start <= spanStart < U.end, comparing (row, column) pairs.
 * The innermost such non-absorbed unit wins; spans with none are returned with unitIndex null.
 */
export function mapSpans(
  difft: DifftasticFileResult,
  oldUnits: DiffUnit[],
  newUnits: DiffUnit[],
  oldSource?: string,
  newSource?: string,
): MappedSpan[] {
  const mapped: MappedSpan[] = [];

  const oldLines = oldSource?.split('\n') ?? [];
  const newLines = newSource?.split('\n') ?? [];

  for (const aligned of difft.aligned_lines) {
    const [oldRow, newRow] = aligned;
    // Skip rows with no alignment
  }

  for (const chunk of difft.chunks) {
    for (const sideEntry of chunk) {
      if (sideEntry.lhs) {
        const line = oldLines[sideEntry.lhs.line_number] ?? '';
        for (const change of sideEntry.lhs.changes) {
          const startCol = byteColToUtf16(line, change.start);
          const endCol = byteColToUtf16(line, change.end);
          const unitIndex = findInnermostUnit(
            { row: sideEntry.lhs.line_number, column: startCol },
            oldUnits,
          );
          mapped.push({
            side: 'old',
            row: sideEntry.lhs.line_number,
            startCol,
            endCol,
            unitIndex,
          });
        }
      }
      if (sideEntry.rhs) {
        const line = newLines[sideEntry.rhs.line_number] ?? '';
        for (const change of sideEntry.rhs.changes) {
          const startCol = byteColToUtf16(line, change.start);
          const endCol = byteColToUtf16(line, change.end);
          const unitIndex = findInnermostUnit(
            { row: sideEntry.rhs.line_number, column: startCol },
            newUnits,
          );
          mapped.push({
            side: 'new',
            row: sideEntry.rhs.line_number,
            startCol,
            endCol,
            unitIndex,
          });
        }
      }
    }
  }

  return mapped;
}

function posLessOrEqual(a: Pos, b: Pos): boolean {
  return a.row < b.row || (a.row === b.row && a.column <= b.column);
}

function posLess(a: Pos, b: Pos): boolean {
  return a.row < b.row || (a.row === b.row && a.column < b.column);
}

/**
 * Find the innermost non-absorbed unit whose start <= spanStart < end.
 */
function findInnermostUnit(spanStart: Pos, units: DiffUnit[]): number | null {
  let best: number | null = null;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.absorbedBy !== null) continue; // skip absorbed units
    if (
      posLessOrEqual(u.start, spanStart) &&
      posLess(spanStart, u.end)
    ) {
      if (best === null) {
        best = i;
      } else {
        // Prefer the inner (later in source order, narrower) unit
        const current = units[best];
        if (
          posLess(current.start, u.start) ||
          (current.start.row === u.start.row && current.start.column === u.start.column && posLess(u.end, current.end))
        ) {
          best = i;
        }
      }
    }
  }
  return best;
}