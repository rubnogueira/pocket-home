// @title Pocket Home
import App from "./app.tsx";
import { mount } from "@pocketjs/framework";
import { TICKS_PER_SECOND, simulationHz } from "@pocketjs/framework/clock";

const dispose = mount(() => <App />);
(globalThis as { __pocketGuestDispose?: () => void }).__pocketGuestDispose = dispose;

// Publish the clock the bundle was built with. The browser host (hosts/web/engine.js) sizes its
// fixed-step loop and the core tick rate from these; @pocketjs/framework 0.12 does not publish
// them, so the host assumed 60 Hz: it painted every other frame on a 120 Hz display (locked at
// 60 fps) and drove this 240 Hz bundle's virtual time at a quarter of real time.
Object.assign(globalThis, {
  __pocketTickHz: TICKS_PER_SECOND,
  __pocketSimHz: simulationHz(),
});
