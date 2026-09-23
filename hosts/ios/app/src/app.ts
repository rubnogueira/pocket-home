// Modern iOS / iPadOS shell — guest assets staged by tools/ios-app.ts.
import "./ios-embedded-present-fix";
import { Application, File, Frame, Page, knownFolders } from "@nativescript/core";
import { styleShellFrame, styleShellPage } from "./ios-chrome";
import { mountPocketGuest, type StagedApp, type StagedPlan } from "./ios-pocket-host";

function readJson<T>(relativePath: string): T {
  const path = knownFolders.currentApp().path + relativePath;
  return JSON.parse(File.fromPath(path).readTextSync()) as T;
}

function createMainPage(): Page {
  const staged = readJson<StagedApp>("/assets/pocket/current.json");
  // Legacy single-guest staging carries its density in the plan; variants name it themselves.
  const plan = staged.variants?.length
    ? null
    : readJson<StagedPlan>(`/assets/pocket/${staged.app}.plan.json`);

  const page = new Page();
  styleShellPage(page);
  mountPocketGuest(page, staged, plan);
  return page;
}

Application.run({
  create: () => {
    const frame = new Frame();
    styleShellFrame(frame);
    frame.navigate({ create: createMainPage });
    return frame;
  },
});
