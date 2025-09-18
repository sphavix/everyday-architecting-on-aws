module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  transformIgnorePatterns: [
    '/node_modules/(?!uuid|@aws-sdk|@smithy)' // 👈 transform these ESM packages
  ],

  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleDirectories: [
    '<rootDir>/node_modules', 
    '<rootDir>/src/api/authorizer/node_modules',
    '<rootDir>/src/api/users/node_modules',
  ],
};


