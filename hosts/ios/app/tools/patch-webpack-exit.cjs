#!/usr/bin/env node
/** NS `compileWithoutWatch` waits for the webpack child `close` event; the stock CLI only sets exitCode. */
const fs = require("node:fs");
const path = require("node:path");

const binPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@nativescript",
  "webpack",
  "dist",
  "bin",
  "index.js",
);

const MARKER = "pocket-home: force process.exit after one-shot webpack build";

function patch() {
  if (!fs.existsSync(binPath)) {
    return;
  }
  let text = fs.readFileSync(binPath, "utf8");
  if (text.includes(MARKER)) {
    return;
  }
  const needle = `        compiler.run((err, status) => {
            compiler.close((err2) => webpackCompilationCallback((err || err2), status));
        });`;
  const replacement = `        compiler.run((err, status) => {
            compiler.close((err2) => {
                webpackCompilationCallback((err || err2), status);
                // ${MARKER}
                if (!options.watch) {
                    process.exit(process.exitCode === undefined ? 0 : process.exitCode);
                }
            });
        });`;
  if (!text.includes(needle)) {
    console.warn("patch-webpack-exit: @nativescript/webpack bin layout changed — skip");
    return;
  }
  text = text.replace(needle, replacement);
  fs.writeFileSync(binPath, text);
}

patch();
