import '@testing-library/jest-dom';

// Mock environment variables
process.env.VITE_AWS_REGION = 'us-east-1';
process.env.VITE_AWS_USER_POOL_ID = 'test-user-pool-id';
process.env.VITE_AWS_USER_POOL_CLIENT_ID = 'test-client-id';
process.env.VITE_AWS_IDENTITY_POOL_ID = 'test-identity-pool-id';
process.env.VITE_API_BASE_URL = 'https://test-api.example.com';
process.env.VITE_YOUTUBE_API_KEY = 'test-youtube-key';
process.env.AWS_REGION = 'us-east-1';
process.env.VITE_NODE_ENV = 'test';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});