module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  transform: {
    // better-auth and its NestJS integration ship ESM only; Babel converts
    // them to CommonJS so the CommonJS test runtime can require them.
    "node_modules/.*\\.m?js$": "<rootDir>/jest-esm-transformer.js",
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: [
    "src/**/*.(t|j)s",
    "!src/**/*.spec.ts",
    "!src/**/*.interface.ts",
    "!src/main.ts",
  ],
  coverageDirectory: "./coverage",
  moduleFileExtensions: ["js", "mjs", "json", "ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^src/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testTimeout: 10000,
  // Every `.mjs` under node_modules is ESM by definition, so none of them are
  // ignored. Packages listed by name additionally ship ESM with a `.js`
  // extension. The leading `(?:...)*` lets the allowlist match a package that
  // is hoisted into a nested `node_modules` too (better-auth pins its own
  // copies of `@noble/hashes` and `jose`), which a bare `node_modules/<pkg>/`
  // check would miss.
  transformIgnorePatterns: [
    "node_modules/(?!(?:(?:@[^/]+/)?[^/]+/node_modules/)*(uuid|@nestjs|@noble|jose)/).*(?<!\\.mjs)$",
  ],
};
