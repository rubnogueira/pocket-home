import type { NativeScriptConfig } from "@nativescript/core";

export default {
  id: "dev.pocket-home.dashboard",
  /** Folder is `ios-app` (NS would default to `iosapp.xcodeproj`); keep slug aligned with generated Xcode tree. */
  projectName: "iossimulator",
  appPath: "src",
  appResourcesPath: "App_Resources",
  ios: {
    runtimePackageName: "@nativescript/ios-quickjs",
  },
} as NativeScriptConfig;
