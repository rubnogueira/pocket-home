// @title Pocket Home
import App from "./app.tsx";
import { mount } from "@pocketjs/framework";

const dispose = mount(() => <App />);
(globalThis as { __pocketGuestDispose?: () => void }).__pocketGuestDispose = dispose;
