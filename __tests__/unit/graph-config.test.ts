import {
  DEFAULT_NODE_STYLE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_NODE_FORCES,
  DEFAULT_EDGE_FORCES,
  DEFAULT_SIMULATION,
} from '@/lib/analysis/graph-config';

describe('graph-config defaults', () => {
  describe('DEFAULT_NODE_STYLE', () => {
    it('has a hex color string', () => {
      expect(DEFAULT_NODE_STYLE.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('has a positive radius', () => {
      expect(DEFAULT_NODE_STYLE.radius).toBeGreaterThan(0);
    });

    it('has opacity between 0 and 1', () => {
      expect(DEFAULT_NODE_STYLE.opacity).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_NODE_STYLE.opacity).toBeLessThanOrEqual(1);
    });

    it('has label disabled by default', () => {
      expect(DEFAULT_NODE_STYLE.label).toBe(false);
    });
  });

  describe('DEFAULT_EDGE_STYLE', () => {
    it('has a hex color string', () => {
      expect(DEFAULT_EDGE_STYLE.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('has a positive width', () => {
      expect(DEFAULT_EDGE_STYLE.width).toBeGreaterThan(0);
    });

    it('has opacity between 0 and 1', () => {
      expect(DEFAULT_EDGE_STYLE.opacity).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_EDGE_STYLE.opacity).toBeLessThanOrEqual(1);
    });
  });

  describe('DEFAULT_NODE_FORCES', () => {
    it('has negative charge (repulsive)', () => {
      expect(DEFAULT_NODE_FORCES.charge).toBeLessThan(0);
    });

    it('has positive collide radius', () => {
      expect(DEFAULT_NODE_FORCES.collideRadius).toBeGreaterThan(0);
    });

    it('has null fixed positions (free movement)', () => {
      expect(DEFAULT_NODE_FORCES.fx).toBeNull();
      expect(DEFAULT_NODE_FORCES.fy).toBeNull();
    });
  });

  describe('DEFAULT_EDGE_FORCES', () => {
    it('has positive distance', () => {
      expect(DEFAULT_EDGE_FORCES.distance).toBeGreaterThan(0);
    });

    it('has strength between 0 and 1', () => {
      expect(DEFAULT_EDGE_FORCES.strength).toBeGreaterThan(0);
      expect(DEFAULT_EDGE_FORCES.strength).toBeLessThanOrEqual(1);
    });
  });

  describe('DEFAULT_SIMULATION', () => {
    it('has positive centerStrength', () => {
      expect(DEFAULT_SIMULATION.centerStrength).toBeGreaterThan(0);
    });

    it('has positive collisionPadding', () => {
      expect(DEFAULT_SIMULATION.collisionPadding).toBeGreaterThan(0);
    });

    it('has positive alphaDecay', () => {
      expect(DEFAULT_SIMULATION.alphaDecay).toBeGreaterThan(0);
    });

    it('has positive velocityDecay', () => {
      expect(DEFAULT_SIMULATION.velocityDecay).toBeGreaterThan(0);
    });
  });
});
