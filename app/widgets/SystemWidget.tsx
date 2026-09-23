import { onMounted, onScopeDispose, ref } from "vue";
import { Text, View } from "@pocketjs/framework/components";
import { after, simulationHz, TICKS_PER_SECOND, virtualFrame } from "@pocketjs/framework/clock";
import { SURFACE_STAT } from "../ui/tokens.ts";

function formatUptime(frames: number): string {
  // Virtual frames run at the simulation rate (the host may run fewer than TICKS_PER_SECOND).
  const totalSeconds = Math.floor(frames / simulationHz());
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function StatusRow(props: { label: string; value: string; accentIndex: number }) {
  return (
    <View class={SURFACE_STAT}>
      <Text class="text-xs text-slate-500">{props.label}</Text>
      <Text
        class={
          props.accentIndex === 0
            ? "text-sm font-bold text-blue-400"
            : props.accentIndex === 1
              ? "text-sm font-bold text-emerald-400"
              : props.accentIndex === 2
                ? "text-sm font-bold text-amber-400"
                : "text-sm font-bold text-violet-400"
        }
      >
        {props.value}
      </Text>
    </View>
  );
}

export default function SystemWidget() {
  const uptime = ref("00:00:00");
  const frame = ref("0");

  let cancel: (() => void) | undefined;

  function tick(): void {
    const f = virtualFrame();
    uptime.value = formatUptime(f);
    frame.value = String(f);
  }

  function schedule(): void {
    cancel = after(1, () => {
      tick();
      schedule();
    });
  }

  onMounted(() => {
    schedule();
  });
  onScopeDispose(() => {
    if (cancel) cancel();
  });

  return (
    <View class="flex-col flex-1 gap-2">
      <StatusRow label="Runtime" value="PocketJS" accentIndex={0} />
      <StatusRow label="Framework" value="Vue Vapor" accentIndex={1} />
      <StatusRow label="FPS Target" value={String(TICKS_PER_SECOND)} accentIndex={2} />
      <StatusRow label="Version" value="0.1.0" accentIndex={3} />

      <View class="flex-col gap-1 mt-1">
        <View class="flex-row items-center justify-between">
          <Text class="text-xs text-slate-500">Uptime</Text>
          <Text class="text-sm text-cyan-400 font-bold">{uptime.value}</Text>
        </View>
        <View class="flex-row items-center justify-between">
          <Text class="text-xs text-slate-500">Frame</Text>
          <Text class="text-sm text-slate-400">{frame.value}</Text>
        </View>
      </View>
    </View>
  );
}
