module.exports = {
  polygonHull: jest.fn((points) => {
    // Simple convex hull implementation for testing
    if (!points || points.length < 3) {
      return points;
    }
    
    // Graham scan algorithm
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    
    const lower = [];
    for (let i = 0; i < sorted.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
        lower.pop();
      }
      lower.push(sorted[i]);
    }
    
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
        upper.pop();
      }
      upper.push(sorted[i]);
    }
    
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }),
};
