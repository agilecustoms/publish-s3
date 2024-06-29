import type { Config } from '@jest/types';

/**
 * Base jest configuration. Serves two purposes:
 * - shared configuration for unit and integration tests
 * - this file is used by IDE. In IDE I want to launch both types of test by single click, so it has no specific directory
 */
const config: Config.InitialOptions = {
    preset: 'ts-jest',
    testEnvironment: 'node',

    roots: ["<rootDir>"],
    modulePaths: ["./"],
    moduleNameMapper: {
        "^/(.*)$": "<rootDir>/src/$1",
    },
}
export default config;
