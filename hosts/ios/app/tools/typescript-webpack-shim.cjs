// Preload before NativeScript/webpack: TS 7's package export is version-only; webpack tooling
// still require()s the legacy compiler API from the typescript-webpack (5.9) package.
const Module = require("node:module");
const path = require("node:path");

const ts5Root = path.dirname(require.resolve("typescript-webpack/package.json"));
const ts5Entry = path.join(ts5Root, "lib", "typescript.js");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "typescript") {
    return ts5Entry;
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
