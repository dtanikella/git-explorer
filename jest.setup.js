require('@testing-library/jest-dom')

// Polyfill TextEncoder/TextDecoder for jsdom
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// Default fetch mock so components that autosave (e.g. AreaContext) don't
// crash the test process when a test file doesn't define its own fetch mock.
// Only installs when nothing has already set global.fetch (module-scope
// assignments like `global.fetch = jest.fn(...)` in a test file run before
// this, so they take precedence and are left alone).
beforeEach(() => {
  if (!global.fetch) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  }
});

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

jest.mock('d3-zoom', () => ({
  zoom: jest.fn(() => {
    const zoomBehavior = jest.fn();
    zoomBehavior.scaleExtent = jest.fn().mockReturnValue(zoomBehavior);
    zoomBehavior.on = jest.fn().mockReturnValue(zoomBehavior);
    return zoomBehavior;
  }),
  zoomIdentity: { toString: jest.fn().mockReturnValue('') },
}));

jest.mock('d3-selection', () => ({
  select: jest.fn(() => ({
    call: jest.fn(),
  })),
}));

jest.mock('d3-scale-chromatic', () => ({
  interpolateReds: jest.fn((t) => {
    // Returns a simple RGB string based on the normalized value
    const value = Math.round(t * 255);
    return `rgb(255, ${value}, ${value})`;
  }),
}));
