import '@testing-library/jest-dom'

// Polyfill for Next.js API route testing
global.Request = global.Request || class Request {
  constructor(input, init = {}) {
    this.url = input;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body;
  }

  async json() {
    return JSON.parse(this.body);
  }

  async text() {
    return this.body;
  }
};

global.Response = global.Response || class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Map(Object.entries(init.headers || {}));
  }

  async json() {
    return JSON.parse(this.body);
  }

  async text() {
    return this.body;
  }
};
    this.headers = new Map(Object.entries(init?.headers || {}));
  }

  async json() {
    return this.body;
  }
};
