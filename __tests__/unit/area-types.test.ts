import type { Area, AreaType, AreaFile, AreaRuntimeState } from '@/lib/areas/types';
import { AREA_TYPES, validateAreaFile } from '@/lib/areas/types';

describe('Area types', () => {
  it('AREA_TYPES contains all valid area types', () => {
    expect(AREA_TYPES).toContain('business_domain');
    expect(AREA_TYPES).toContain('utils');
    expect(AREA_TYPES).toContain('external_service');
    expect(AREA_TYPES).toContain('internal_service');
    expect(AREA_TYPES).toContain('library');
    expect(AREA_TYPES).toContain('entrypoint');
    expect(AREA_TYPES).toHaveLength(6);
  });

  it('validateAreaFile accepts a valid AreaFile', () => {
    const valid: AreaFile = {
      version: 1,
      areas: [
        {
          id: 'auth',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          name: 'Authentication',
          type: 'business_domain',
          contains: ['sym1', 'sym2'],
          parent: null,
          children: [],
          clusterStrength: 0,
        },
      ],
    };
    expect(validateAreaFile(valid)).toEqual({ valid: true, errors: [] });
  });

  it('validateAreaFile rejects missing version', () => {
    const invalid = { areas: [] } as any;
    const result = validateAreaFile(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid version field');
  });

  it('validateAreaFile rejects invalid area type', () => {
    const invalid: any = {
      version: 1,
      areas: [{
        id: 'x', created_at: '', updated_at: '', name: 'X',
        type: 'invalid_type', contains: [], parent: null, children: [], clusterStrength: 0,
      }],
    };
    const result = validateAreaFile(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/invalid_type/);
  });

  it('validateAreaFile rejects clusterStrength out of range', () => {
    const invalid: any = {
      version: 1,
      areas: [{
        id: 'x', created_at: '', updated_at: '', name: 'X',
        type: 'utils', contains: [], parent: null, children: [], clusterStrength: 1.5,
      }],
    };
    const result = validateAreaFile(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/clusterStrength/);
  });
});
