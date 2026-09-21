// TS 7 in devDependencies is IDE-only; webpack/ts-loader need the 5.9 compiler API (see tools/typescript-webpack-shim.cjs).
require("./tools/typescript-webpack-shim.cjs");

const webpack = require("@nativescript/webpack");

module.exports = (env) => {
  webpack.init(env);
  // Copy-webpack `assets/**` occasionally omits `.pak`; explicit glob keeps guest assets in sync.
  webpack.Utils.addCopyRule("assets/**/*.pak");
  const chain = webpack.resolveChainableConfig();
  chain.plugins.delete("ForkTsCheckerWebpackPlugin");
  // NS `compileWithoutWatch` waits for the webpack child to exit (see tools/patch-webpack-exit.cjs).
  chain.plugin("ExitAfterOneShotBuild").use(
    class ExitAfterOneShotBuild {
      apply(compiler) {
        compiler.hooks.done.tap("ExitAfterOneShotBuild", (stats) => {
          process.exit(stats.hasErrors() ? 1 : 0);
        });
      }
    },
  );
  return webpack.resolveConfig(chain);
};
