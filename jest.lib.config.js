module.exports = {
  testEnvironment: 'node',
  maxWorkers: 1,
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};