/**
 * Jest transformer for ESM-only dependencies.
 *
 * `better-auth` and `@thallesp/nestjs-better-auth` publish ESM only. ts-jest
 * cannot down-level those files, because TypeScript always treats `.mjs` as
 * ESM, so `.mjs` files are routed here and Babel rewrites them to CommonJS.
 *
 * Two ESM-only constructs have no CommonJS equivalent and are rewritten too:
 * `import.meta` (better-auth calls `createRequire(import.meta.url)`) and
 * top-level dynamic `import()` (better-auth loads `node:async_hooks` that
 * way), which would otherwise reach Node's vm loader that Jest does not
 * enable.
 */
const babelJest = require("babel-jest").default;

const rewriteEsmOnlySyntax = () => ({
  visitor: {
    MetaProperty(path) {
      path.replaceWithSourceString(
        "({ url: require('node:url').pathToFileURL(__filename).href })",
      );
    },
    CallExpression(path) {
      if (path.node.callee.type !== "Import") return;
      const [specifier] = path.node.arguments;
      const source = path.hub.file.code.slice(specifier.start, specifier.end);
      path.replaceWithSourceString(
        `Promise.resolve().then(() => require(${source}))`,
      );
    },
  },
});

module.exports = babelJest.createTransformer({
  babelrc: false,
  configFile: false,
  plugins: ["@babel/plugin-transform-modules-commonjs", rewriteEsmOnlySyntax],
});
