import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import nextPlugin from '@next/eslint-plugin-next';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const files = ['**/*.{js,jsx,ts,tsx}'];

const tsxFiles = ['**/*.tsx'];
const apiFiles = ['app/api/**/*.ts'];
const utilsFiles = ['lib/utils/**/*.ts', 'lib/services/**/*.ts'];

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
      'temp/**',
    ],
  },
  {
    files,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: resolve(__dirname),
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      import: importPlugin,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 250, skipBlankLines: true, skipComments: true, IIFEs: true }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', 'scripts/**', 'tests/**'] }],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
  {
    files: tsxFiles,
    rules: {
      'max-lines-per-function': ['error', { max: 250, skipBlankLines: true, skipComments: true, IIFEs: true }],
    },
  },
  {
    files: apiFiles,
    rules: {
      'max-lines-per-function': ['error', { max: 250, skipBlankLines: true, skipComments: true, IIFEs: true }],
    },
  },
  {
    files: utilsFiles,
    rules: {
      'max-lines-per-function': ['error', { max: 250, skipBlankLines: true, skipComments: true, IIFEs: true }],
    },
  },
  {
    files: ['lib/utils/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
    },
  }
);