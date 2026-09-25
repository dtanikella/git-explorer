/**
 * Canonical list of area type labels.
 *
 * @remarks
 * Each area must have exactly one type from this list. Types are used
 * for visual classification (color coding, grouping) and are not
 * persisted as a separate enum to keep the JSON schema simple.
 *
 * @see commit bd44d59
 */
export const AREA_TYPES = [
  'business_domain',
  'utils',
  'external_service',
  'internal_service',
  'library',
  'entrypoint',
] as const;

/**
 * Discriminated union of all valid area types.
 *
 * @remarks
 * Derived from the AREA_TILES constant array.
 */
export type AreaType = (typeof AREA_TYPES)[number];

/**
 * An area node in the hierarchy.
 *
 * @remarks
 * Each area has a type, a list of contained node symbols (by SCIP symbol),
 * an optional parent for nesting, and children references. Areas hold
 * force-configuration parameters (clusterStrength, pinnedZones) that
 * affect simulation behavior.
 *
 * @see commit bd44d59
 * @see PR #38, #39, #40
 */
export interface Area {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  type: AreaType;
  contains: string[];
  parent: string | null;
  children: string[];
  clusterStrength: number;
  pinnedZones?: number[];
  color?: string;
}

/**
 * The on-disk JSON structure for area persistence.
 *
 * @remarks
 * Wraps the areas array with a schema version number for forward
 * compatibility.
 */
export interface AreaFile {
  version: 1;
  areas: Area[];
}

/**
 * Per-area runtime state that is not persisted to disk.
 *
 * @remarks
 * Includes visibility toggles and resolved display color.
 */
export interface AreaRuntimeState {
  visible: boolean;
  color: string;
}

/**
 * Result of validating an area file JSON payload.
 *
 * @remarks
 * Validation errors are accumulated and returned as an array rather
 * than failing on the first error.
 */
export interface AreaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a parsed JSON object as an area file structure.
 *
 * @remarks
 * Checks for the expected schema: `version` must be 1, `areas` must be an
 * array, each area must have an `id` and `name`, and containment references
 * must resolve within the file. Returns all validation errors found rather
 * than failing on the first one.
 *
 * @param data - The parsed JSON value (usually from `JSON.parse`).
 * @returns An {@link AreaValidationResult} with the validity flag and any
 *   error messages.
 * @see commit bd44d59
 */
export function validateAreaFile(data: unknown): AreaValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input is not an object'] };
  }

  const obj = data as Record<string, unknown>;

  if (obj.version !== 1) {
    errors.push('Missing or invalid version field');
  }

  if (!Array.isArray(obj.areas)) {
    errors.push('Missing or invalid areas array');
    return { valid: false, errors };
  }

  for (const area of obj.areas) {
    if (!area || typeof area !== 'object') {
      errors.push('Area entry is not an object');
      continue;
    }
    const a = area as Record<string, unknown>;

    if (typeof a.type !== 'string' || !(AREA_TYPES as readonly string[]).includes(a.type)) {
      errors.push(`Area "${a.id}": invalid type "${a.type}"`);
    }

    if (typeof a.clusterStrength !== 'number' || a.clusterStrength < 0 || a.clusterStrength > 1) {
      errors.push(`Area "${a.id}": clusterStrength must be between 0 and 1`);
    }

    if (a.pinnedZones !== undefined) {
      if (!Array.isArray(a.pinnedZones)) {
        errors.push(`Area "${a.id}": pinnedZones must be an array`);
      } else {
        for (let i = 0; i < a.pinnedZones.length; i++) {
          const z = a.pinnedZones[i];
          if (!Number.isInteger(z) || z < 0 || z > 8) {
            errors.push(`Area "${a.id}": pinnedZones[${i}] must be an integer 0-8`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
