import { Empty } from "./Empty.tsx";

function stub(name: string, reason: string) {
  return function Stub() {
    return <Empty title={name} description={reason} />;
  };
}

export const Chart = stub(
  "Chart",
  "Use Progress, Table, or a custom canvas compositor for charts.",
);
export const Command = stub(
  "Command",
  "Command palette needs indexed search — not on PocketJS v1.",
);
export const Combobox = stub("Combobox", "Use Select or Tabs for discrete choices.");
export const InputOTP = stub("Input OTP", "Use Input rows or the system OSK TextField.");
export const Resizable = stub("Resizable", "Layout is Taffy flex — use style width/height props.");
export const Calendar = stub("Calendar", "See CalendarWidget for month grid.");
