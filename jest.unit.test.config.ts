import type { Config } from '@jest/types';
import * as base from './jest.config';

/**
 * Jest configuration for unit tests
 */
const config: Config.InitialOptions = {...base.default,
    testMatch: ["<rootDir>/test/**/*.test.ts"],
}
export default config;
