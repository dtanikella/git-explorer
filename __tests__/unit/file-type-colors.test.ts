import { getFileTypeColor } from '@/lib/treemap/file-type-colors';

describe('getFileTypeColor', () => {
  describe('Ruby files', () => {
    it('returns ruby red for .rb files', () => {
      expect(getFileTypeColor('app/models/user.rb')).toBe('#E0115F');
      expect(getFileTypeColor('lib/helper.rb')).toBe('#E0115F');
      expect(getFileTypeColor('script.rb')).toBe('#E0115F');
    });
  });

  describe('TypeScript React files', () => {
    it('returns light blue for .tsx files', () => {
      expect(getFileTypeColor('components/Button.tsx')).toBe('#ADD8E6');
      expect(getFileTypeColor('App.tsx')).toBe('#ADD8E6');
    });
  });

  describe('Test files', () => {
    it('returns gray for files in __tests__ directory', () => {
      expect(getFileTypeColor('__tests__/helper.ts')).toBe('#808080');
      expect(getFileTypeColor('src/__tests__/utils.tsx')).toBe('#808080');
    });

    it('returns gray for files in test/tests directory', () => {
      expect(getFileTypeColor('test/unit.ts')).toBe('#808080');
      expect(getFileTypeColor('tests/integration.ts')).toBe('#808080');
    });

    it('returns gray for .test. pattern files', () => {
      expect(getFileTypeColor('Button.test.tsx')).toBe('#808080');
      expect(getFileTypeColor('utils.test.ts')).toBe('#808080');
    });

    it('returns gray for .spec. pattern files', () => {
      expect(getFileTypeColor('api.spec.js')).toBe('#808080');
      expect(getFileTypeColor('component.spec.tsx')).toBe('#808080');
    });

    it('prioritizes test pattern over extension', () => {
      expect(getFileTypeColor('User.test.rb')).toBe('#808080');
      expect(getFileTypeColor('Component.test.tsx')).toBe('#808080');
      expect(getFileTypeColor('__tests__/model.rb')).toBe('#808080');
    });
  });

  describe('Other files', () => {
    it('returns gray for non-rb, non-tsx files', () => {
      expect(getFileTypeColor('README.md')).toBe('#808080');
      expect(getFileTypeColor('package.json')).toBe('#808080');
      expect(getFileTypeColor('src/utils.ts')).toBe('#808080');
    });

    it('handles empty path', () => {
      expect(getFileTypeColor('')).toBe('#808080');
    });
  });
});