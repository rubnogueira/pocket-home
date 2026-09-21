import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IOS_APP_SHELL } from "../ios/paths.ts";

const SHELL_DIR = IOS_APP_SHELL;
const PLATFORMS_IOS = join(SHELL_DIR, "platforms/ios");
const APP_RESOURCES_XCCONFIG = join(SHELL_DIR, "App_Resources/iOS/build.xcconfig");
const IOS_NS_PROJECT_NAME = "iossimulator";

const MERGE_RUBY = `
require 'xcodeproj'
destination, source = ARGV
inherited = /\\$[({]inherited[)}]/
userConfig = Xcodeproj::Config.new(destination)
existingConfig = Xcodeproj::Config.new(source)
userConfig.attributes.each do |key, kept|
  next unless existingConfig.attributes.key?(key)
  incoming = existingConfig.attributes[key]
  if kept.to_s =~ inherited
    appended = incoming.to_s.gsub(inherited, '').strip
    if appended.empty?
      existingConfig.attributes.delete(key)
    else
      existingConfig.attributes[key] = appended
    end
    next
  end
  existingConfig.attributes.delete(key) if incoming.to_s != kept.to_s
end
userConfig.merge(existingConfig).save_as(Pathname.new(destination))
`;

function pluginBuildXcconfigs(): string[] {
  const paths: string[] = [];
  const scoped = join(SHELL_DIR, "node_modules/@nativescript");
  if (!existsSync(scoped)) return paths;
  for (const pkg of readdirSync(scoped)) {
    const candidate = join(scoped, pkg, "platforms/ios/build.xcconfig");
    if (existsSync(candidate)) paths.push(candidate);
  }
  return paths;
}

/** NativeScript-style plugins-*.xcconfig without `bundle exec` (use ruby-shim on PATH). */
function writePluginsXcconfigFile(name: string): void {
  const dest = join(PLATFORMS_IOS, name);
  const fromApp = readFileSync(APP_RESOURCES_XCCONFIG, "utf8")
    .split("\n")
    .filter((line) => !line.startsWith("CODE_SIGN_ENTITLEMENTS"))
    .join("\n")
    .trimEnd();
  const entitlements = `CODE_SIGN_ENTITLEMENTS = ${IOS_NS_PROJECT_NAME}/${IOS_NS_PROJECT_NAME}.entitlements`;
  writeFileSync(dest, `${fromApp}\n${entitlements}\n`);
}

function runRubyMerge(
  destination: string,
  source: string,
  env: Record<string, string | undefined>,
): void {
  const result = Bun.spawnSync({
    cmd: ["ruby", "-e", MERGE_RUBY, destination, source],
    cwd: SHELL_DIR,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const err = [result.stderr.toString(), result.stdout.toString()].filter(Boolean).join("\n");
    throw new Error(`ios-app: xcconfig merge failed (${destination}):\n${err}`);
  }
}

/** Populates `platforms/ios/plugins-*.xcconfig` (NativeScript expects these before xcodebuild). */
export function mergeIosPluginsXcconfig(env: Record<string, string | undefined>): void {
  if (!existsSync(APP_RESOURCES_XCCONFIG)) {
    throw new Error("ios-app: missing App_Resources/iOS/build.xcconfig");
  }

  const plugins = pluginBuildXcconfigs();
  for (const name of ["plugins-debug.xcconfig", "plugins-release.xcconfig"]) {
    console.log(`ios-app: writing ${name}…`);
    if (plugins.length === 0) {
      writePluginsXcconfigFile(name);
      continue;
    }
    const dest = join(PLATFORMS_IOS, name);
    writeFileSync(dest, "");
    runRubyMerge(dest, APP_RESOURCES_XCCONFIG, env);
    for (const pluginXc of plugins) {
      runRubyMerge(dest, pluginXc, env);
    }
  }
}
