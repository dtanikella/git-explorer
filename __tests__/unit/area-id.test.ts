import { slugify, generateAreaId } from '@/lib/areas/id';

describe('slugify', () => {
  it('converts to lowercase and replaces spaces with hyphens', () => {
    expect(slugify('Auth Service')).toBe('auth-service');
  });

  it('removes special characters', () => {
    expect(slugify('Config Pipeline!@#$')).toBe('config-pipeline');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('handles empty input', () => {
    expect(slugify('')).toBe('');
  });
});

describe('generateAreaId', () => {
  it('returns a slug with random suffix', () => {
    const id = generateAreaId('Auth Service');
    expect(id).toMatch(/^auth-service-[a-f0-9]{4}$/);
  });

  it('generates unique IDs for the same name', () => {
    const id1 = generateAreaId('Test');
    const id2 = generateAreaId('Test');
    expect(id1).not.toBe(id2);
  });
});