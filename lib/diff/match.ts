import type { ParsedFilePair } from './file-trees';
import type { DiffUnit, LabelledDeclaration, MappedSpan } from './types';
import { extractUnits, mapSpans } from './units';

/**
 * Label every unit of one modified file pair as added, deleted, modified or unchanged.
 *
 * Algorithm (step 6):
 * 1. rowMap = old row -> new row, from aligned_lines pairs where both sides are non-null.
 * 2. For each non-absorbed old unit O, in source order:
 *    r = rowMap.get(O.namePos.row); if r is undefined, O is unpaired.
 *    Otherwise pair O with the single non-absorbed, not-yet-paired new unit N where
 *    N.namePos.row === r && N.kind === O.kind && N.qualifiedName === O.qualifiedName.
 *    If there is no such N, O is unpaired.
 * 3. A paired (O, N) is 'modified' when any mapped span has unitIndex O.index on the old side
 *    or N.index on the new side, and 'unchanged' otherwise.
 * 4. Unpaired old units are 'deleted', unpaired new units are 'added'.
 * 5. Each absorbed unit takes the label of its absorbedBy unit on the same side.
 */
export function labelModifiedFile(
  pair: ParsedFilePair,
): { labels: LabelledDeclaration[]; unmapped: MappedSpan[] } {
  if (!pair.oldTree || !pair.newTree || !pair.difft) {
    throw new Error('labelModifiedFile requires both trees and a difft result');
  }

  const oldUnits = extractUnits(pair.oldTree, pair.path, 'old');
  const newUnits = extractUnits(pair.newTree, pair.path, 'new');

  // Map spans
  const spans = mapSpans(pair.difft, oldUnits, newUnits, pair.oldSource, pair.newSource);

  // Build rowMap: old row -> new row
  const rowMap = new Map<number, number>();
  for (const [oldRow, newRow] of pair.difft.aligned_lines) {
    if (oldRow !== null && newRow !== null) {
      rowMap.set(oldRow, newRow);
    }
  }

  // Track which new units have been paired
  const pairedNew = new Set<number>();

  // Labels for non-absorbed units
  const labels: LabelledDeclaration[] = [];

  // Step 2: Pair old units with new units
  for (const oldUnit of oldUnits) {
    if (oldUnit.absorbedBy !== null) continue; // skip absorbed

    const matchedRow = rowMap.get(oldUnit.namePos.row);
    if (matchedRow === undefined) {
      // Unpaired old -> deleted
      labels.push({ unit: oldUnit, status: 'deleted' });
      continue;
    }

    // Find matching new unit: same row, kind, qualifiedName, not already paired
    const match = newUnits.find(
      (nu) =>
        nu.absorbedBy === null &&
        nu.namePos.row === matchedRow &&
        nu.kind === oldUnit.kind &&
        nu.qualifiedName === oldUnit.qualifiedName &&
        !pairedNew.has(nu.index),
    );

    if (!match) {
      // Unpaired old -> deleted
      labels.push({ unit: oldUnit, status: 'deleted' });
      continue;
    }

    pairedNew.add(match.index);

    // Step 3: Check if any span touches this pair
    const isModified = spans.some(
      (s) =>
        (s.side === 'old' && s.unitIndex === oldUnit.index) ||
        (s.side === 'new' && s.unitIndex === match.index),
    );

    labels.push({
      unit: oldUnit,
      status: isModified ? 'modified' : 'unchanged',
    });

    // Also label the new side of the pair
    labels.push({
      unit: match,
      status: isModified ? 'modified' : 'unchanged',
    });
  }

  // Step 4: Remaining unpaired new units -> added
  for (const newUnit of newUnits) {
    if (newUnit.absorbedBy !== null) continue; // skip absorbed
    if (pairedNew.has(newUnit.index)) continue; // already labelled

    labels.push({ unit: newUnit, status: 'added' });
  }

  // Step 5: Absorbed units take the label of their absorbedBy unit on the same side
  for (const oldUnit of oldUnits) {
    if (oldUnit.absorbedBy === null) continue;
    const absorberLabel = labels.find(
      (l) => l.unit.side === 'old' && l.unit.index === oldUnit.absorbedBy,
    );
    if (absorberLabel) {
      labels.push({ unit: oldUnit, status: absorberLabel.status });
    } else {
      labels.push({ unit: oldUnit, status: 'unchanged' });
    }
  }

  for (const newUnit of newUnits) {
    if (newUnit.absorbedBy === null) continue;
    const absorberLabel = labels.find(
      (l) => l.unit.side === 'new' && l.unit.index === newUnit.absorbedBy,
    );
    if (absorberLabel) {
      labels.push({ unit: newUnit, status: absorberLabel.status });
    } else {
      labels.push({ unit: newUnit, status: 'unchanged' });
    }
  }

  // Unmapped spans (no containing unit)
  const unmapped = spans.filter(s => s.unitIndex === null);

  return { labels, unmapped };
}