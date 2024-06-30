import tseslint from "typescript-eslint";

export default [
    ...tseslint.configs.recommended,
    {
        files: ["integration-tests/*.ts"],
        rules: {
            "@typescript-eslint/no-extra-non-null-assertion": "off"
        }
    }
];
