// Modern iOS / iPadOS shell — guest assets staged by tools/ios-app.ts.
import "./ios-embedded-present-fix";
import { Application, File, Frame, Page, knownFolders } from "@nativescript/core";
import { bindOrientationRelayout, styleShellFrame, styleShellPage } from "./ios-chrome";
import { mountPocketGuest } from "./ios-pocket-host";
import { syncEmbeddedRootLayout } from "./ios-embedded-layout";

type StagedApp = { app: string; externalGuest?: boolean; tickHz?: number };
type StagedPlan = { viewport: { logical: [number, number]; rasterDensity: number } };

function readJson<T>(relativePath: string): T {
  const path = knownFolders.currentApp().path + relativePath;
  return JSON.parse(File.fromPath(path).readTextSync()) as T;
}

function createMainPage(frame: Frame): Page {
  const staged = readJson<StagedApp>("/assets/pocket/current.json");
  const plan = readJson<StagedPlan>(`/assets/pocket/${staged.app}.plan.json`);

  const page = new Page();
  styleShellPage(page);

  const host = mountPocketGuest(page, frame, staged, plan);
  bindOrientationRelayout(page, host, frame);

  page.on(Page.navigatedToEvent, () => {
    syncEmbeddedRootLayout();
  });

  return page;
}

Application.run({
  create: () => {
    const frame = new Frame();
    styleShellFrame(frame);
    frame.navigate({ create: () => createMainPage(frame) });
    return frame;
  },
});
