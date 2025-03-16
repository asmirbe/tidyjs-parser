const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const eslintJs = require('@eslint/js');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
    // Ignorer les fichiers (anciennement dans .eslintignore)
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            '*.js',
            '*.d.ts',
        ],
    },
    // Configuration de base
    eslintJs.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module',
                project: './tsconfig.json',
            },
            globals: {
                // Équivalent à env: { node: true, es6: true }
                node: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            // Règles de base
            'no-console': 'warn',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',

            // Règles additionnelles
            'quotes': ['error', 'single', { avoidEscape: true }],
            'semi': ['error', 'always'],
            'indent': ['error', 2],
            'comma-dangle': ['error', 'always-multiline'],
        },
    },
    // Appliquer les règles de prettier
    prettierConfig,
];
