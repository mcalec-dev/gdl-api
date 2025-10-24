const glob = require('fast-glob')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')
const json = require('@rollup/plugin-json')
const copy = require('rollup-plugin-copy')
const inputFiles = glob.sync([
  "routes/**/*.js",
  "utils/**/*.js",
  "models/**/*.js",
  "views/**/*.js"
], {
  ignore: ['**/node_modules/**','**/client/**','**/bot/**'],
});
module.exports = {
  input: inputFiles,
  output: {
    dir: "dist",
    format: "cjs",
    sourcemap: true,
    entryFileNames: "[name].js",
  },
  plugins: [
    nodeResolve({
      preferBuiltins: true,
    }),
    commonjs(),
    json(),
    copy({
      targets: [
        { src: "public/**/*", dest: "dist/public" }
      ],
      verbose: true
    })
  ],
  onwarn(warning, warn) {
    if (warning.code === 'CIRCULAR_DEPENDENCY') return
    warn(warning)
  },
  preserveEntrySignatures: 'strict',
};
