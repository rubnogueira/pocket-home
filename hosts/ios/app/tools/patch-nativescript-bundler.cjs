#!/usr/bin/env node
/**
 * When POCKET_IOS_WEBPACK_DONE=1, skip NS compileWithoutWatch (Pocket Home runs webpack separately).
 */
const fs = require("node:fs");
const path = require("node:path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "nativescript",
  "lib",
  "services",
  "bundler",
  "bundler-compiler-service.js",
);

const MARKER = "POCKET_IOS_WEBPACK_DONE";

function patch() {
  if (!fs.existsSync(target)) return;
  let text = fs.readFileSync(target, "utf8");
  if (text.includes(MARKER)) return;

  const needle = `    async compileWithoutWatch(platformData, projectData, prepareData) {
        return new Promise(async (resolve, reject) => {
            if (this.bundlerProcesses[platformData.platformNameLowerCase]) {
                resolve();
                return;
            }`;

  const replacement = `    async compileWithoutWatch(platformData, projectData, prepareData) {
        return new Promise(async (resolve, reject) => {
            if (process.env.${MARKER} === "1") {
                resolve();
                return;
            }
            if (this.bundlerProcesses[platformData.platformNameLowerCase]) {
                resolve();
                return;
            }`;

  if (!text.includes(needle)) {
    console.warn("patch-nativescript-bundler: bundler-compiler-service layout changed — skip");
    return;
  }
  fs.writeFileSync(target, text.replace(needle, replacement));
}

patch();
