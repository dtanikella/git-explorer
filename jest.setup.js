require('@testing-library/jest-dom')

// Mock d3 modules globally for all tests
jest.mock('d3-force', () => ({
  forceSimulation: jest.fn(() => {
    const methods = {
      nodes: jest.fn().mockReturnValue(methods),
      force: jest.fn().mockReturnValue(methods),
      on: jest.fn().mockReturnValue(methods),
      alpha: jest.fn().mockReturnValue(0.1),
      alphaTarget: jest.fn().mockReturnValue(methods),
      restart: jest.fn().mockReturnValue(methods),
      stop: jest.fn().mockReturnValue(methods),
      tick: jest.fn().mockReturnValue(methods),
    };
    return methods;
  }),
  forceCenter: jest.fn(() => ({ x: jest.fn().mockReturnThis(), y: jest.fn().mockReturnThis() })),
  forceCollide: jest.fn(() => ({ radius: jest.fn().mockReturnThis() })),
  forceManyBody: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
}));

jest.mock('d3-scale', () => ({
  scaleSqrt: jest.fn(() => {
    const scale = jest.fn();
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    scale.clamp = jest.fn().mockReturnValue(scale);
    return scale;
  }),
}));
