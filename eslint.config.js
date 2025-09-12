const { defineConfig } = require('eslint/config');
const js = require('@eslint/js');
const json = require('eslint-plugin-json');
module.exports = defineConfig([
  {
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        require: 'readonly', 
        module: 'readonly', 
        __dirname: 'readonly', 
        __filename: 'readonly', 
        exports: 'readonly', 
        process: 'readonly', 
        setInterval: 'readonly', 
        setTimeout: 'readonly', 
        clearInterval: 'readonly', 
        clearTimeout: 'readonly', 
        Buffer: 'readonly', 
        global: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        startTimeout: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
      }
    }
  },
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
      }
    }
  },
  {
    ...json.configs.recommended,
    files: ['**/*.json'],
  },
  { ignores: ['node_modules/**', '**/*.min.js'] }
]);
