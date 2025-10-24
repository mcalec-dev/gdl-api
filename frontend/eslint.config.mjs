const { defineConfig } = require('eslint/config')
const js = require('@eslint/js')
const json = require('eslint-plugin-json')
export default defineConfig([
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        fetch: 'readonly',
        debug: 'readonly',
        IntersectionObserver: 'readonly',
        URLSearchParams: 'readonly',
        localStorage: 'readonly',
        history: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    ...json.configs.recommended,
    files: ['**/*.json'],
  },
  { ignores: ['node_modules/**', '**/*.min.js'] },
])
