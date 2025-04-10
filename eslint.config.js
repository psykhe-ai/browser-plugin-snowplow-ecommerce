// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginImport from 'eslint-plugin-import';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      import: eslintPluginImport,
    },
    rules: {
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'always',
          ts: 'never',
          tsx: 'never',
        },
      ],
    },
  },
];
