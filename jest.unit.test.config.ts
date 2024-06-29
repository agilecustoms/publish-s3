import type { Config } from '@jest/types';

/**
 * Jest configuration for unit tests - our main type of tests
 */
const config: Config.InitialOptions = {
    preset: 'ts-jest',
    testEnvironment: 'node',

    roots: ["<rootDir>"],
    modulePaths: ["./"],
    moduleNameMapper: {
        "^/(.*)$": "<rootDir>/src/$1",
    },
    testMatch: ["<rootDir>/test/**/*.test.ts"],
}
export default config;
