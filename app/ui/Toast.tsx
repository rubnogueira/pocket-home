import { ref } from "vue";
import { after } from "@pocketjs/framework/clock";
import { Text, View } from "@pocketjs/framework/components";

const toastMessage = ref<string | null>(null);

export function toast(message: string, durationTicks = 180): void {
  toastMessage.value = message;
  after(durationTicks, () => {
    if (toastMessage.value === message) toastMessage.value = null;
  });
}

export function Toaster() {
  const message = toastMessage.value;
  return (
    <View
      class="absolute"
      style={{
        insetB: 16,
        insetL: 16,
        insetR: 16,
        zIndex: 80,
        opacity: message ? 1 : 0,
        ...(message ? {} : { height: 0 }),
      }}
    >
      {message ? (
        <View class="px-4 py-3 rounded-xl bg-slate-800 border-slate-600 shadow-lg">
          <Text class="text-sm text-slate-100 font-bold text-center">{message}</Text>
        </View>
      ) : null}
    </View>
  );
}
