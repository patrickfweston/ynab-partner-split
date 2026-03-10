/* eslint-env node */
'use strict';

module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
  },
  globals: {
    chrome: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script',
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    'strict': ['error', 'global'],
    'eqeqeq': ['error', 'always'],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
