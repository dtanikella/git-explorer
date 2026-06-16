export const AREA_TYPES = [
  'business_domain',
  'utils',
  'external_service',
  'internal_service',
  'library',
  'entrypoint',
] as const;

export type AreaType = (typeof AREA_TYPES)[number];

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
}

export interface AreaFile {
  version: 1;
  areas: Area[];
}

export interface AreaRuntimeState {
  visible: boolean;
  color: string;
}

export interface AreaValidationResult {
  valid: boolean;
  errors: string[];
}

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
  }

  return { valid: errors.length === 0, errors };
}
