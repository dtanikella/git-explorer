const NextRequest = jest.fn().mockImplementation((url, options = {}) => ({
  url,
  method: options.method || 'GET',
  headers: new Map(Object.entries(options.headers || {})),
  json: async () => JSON.parse(options.body || '{}'),
  text: async () => options.body || '',
}));

const NextResponse = {
  json: jest.fn().mockImplementation((data, options = {}) => ({
    status: options.status || 200,
    json: async () => data,
  })),
};

module.exports = {
  NextRequest,
  NextResponse,
};