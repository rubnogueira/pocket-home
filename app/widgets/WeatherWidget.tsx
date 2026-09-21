import { onMounted, onScopeDispose, ref } from "vue";
import { Text, View } from "@pocketjs/framework/components";
import { fetchWeather, mockWeatherData, type WeatherData } from "../data/weather.ts";
import { CONFIG } from "../data/config.ts";
import { poll } from "../data/polling.ts";
import { Alert, Badge, Skeleton } from "../ui/index.ts";

export default function WeatherWidget() {
  const weather = ref<WeatherData>(mockWeatherData());
  const stale = ref(true);
  const loading = ref(false);

  const unitLabel = CONFIG.weather.units === "metric" ? "C" : "F";
  const windUnit = CONFIG.weather.units === "metric" ? "km/h" : "mph";

  async function refresh(): Promise<void> {
    loading.value = true;
    const data = await fetchWeather();
    if (data) {
      weather.value = data;
      stale.value = false;
    }
    loading.value = false;
  }

  let cancelPoll: (() => void) | undefined;

  onMounted(() => {
    refresh();
    cancelPoll = poll(CONFIG.weather.refreshIntervalSeconds, refresh);
  });

  onScopeDispose(() => {
    if (cancelPoll) cancelPoll();
  });

  return (
    <View class="flex-col flex-1 gap-2 items-center justify-center">
      {loading.value && stale.value ? (
        <View class="flex-col gap-2 items-center justify-center">
          <Skeleton width={80} height={36} />
          <Skeleton width={120} height={14} />
          <Skeleton width={160} height={12} />
        </View>
      ) : (
        <View class="flex-col gap-2 items-center justify-center">
          <View class="flex-row items-end gap-1">
            <Text class="text-4xl text-slate-50 font-bold">
              {String(weather.value.temperature)}
            </Text>
            <View class="flex-col pb-1">
              <Text class="text-sm text-slate-400">{`°${unitLabel}`}</Text>
            </View>
          </View>

          <Text class="text-sm text-slate-300">{weather.value.description}</Text>

          <View class="flex-row gap-2 flex-wrap justify-center">
            <Badge label={`Feels ${weather.value.feelsLike}°`} variant="muted" />
            <Badge label={`Humid ${weather.value.humidity}%`} variant="muted" />
            <Badge label={`${weather.value.windSpeed} ${windUnit}`} variant="muted" />
          </View>

          {stale.value ? (
            <Alert
              variant="warning"
              title="Mock data"
              description="Could not load live weather. Showing placeholder data."
            />
          ) : null}
        </View>
      )}
    </View>
  );
}
