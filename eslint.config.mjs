import tseslint from 'typescript-eslint';
import plugin from '@stylistic/eslint-plugin'

export default [
    ...tseslint.configs.recommended,
    {
        files: ['integration-tests/*.ts'],
        rules: {
            '@typescript-eslint/no-extra-non-null-assertion': 'off'
        }
    },
    plugin.configs['recommended-flat'],
    {
        rules: {
            '@stylistic/brace-style': ['error', '1tbs'], // 'else' keyword on the same line as closing brace
            '@stylistic/comma-dangle': 'off', // there are cases when trailing comma desired, and sometimes not
        }
    }
];
