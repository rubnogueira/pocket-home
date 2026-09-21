import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { WeatherForecastCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity, WeatherForecast } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_GAP3_NO_PAD } from "../ui/tokens.ts";
import { Badge } from "../ui/index.ts";
import HaIcon from "../icons/HaIcon.tsx";
import { WEATHER_CONDITION_ICONS } from "../icons/resolve.ts";

export interface WeatherForecastCardProps {
  config: WeatherForecastCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function WeatherForecastCard(props: WeatherForecastCardProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(() => props.entities[props.config.entity] as HassEntity | undefined);
  const name = computed(() => props.config.name ?? entityName(entity.value, props.config.entity));
  const showCurrent = props.config.show_current !== false;
  const showForecast = props.config.show_forecast !== false;

  const temp = computed(() => entity.value?.attributes.temperature);
  const humidity = computed(() => entity.value?.attributes.humidity);
  const wind = computed(() => entity.value?.attributes.wind_speed);
  const condition = computed(() => entity.value?.state ?? "unknown");
  const forecast = computed(() => (entity.value?.attributes.forecast ?? []) as WeatherForecast[]);

  function handleTap() {
    showMoreInfo(props.config.entity);
  }

  return (
    <Focusable class={HA_CARD_PRESS_GAP3_NO_PAD} onPress={handleTap}>
      {showCurrent ? (
        <View class="flex-col gap-2 p-3">
          <View class="flex-row items-center justify-between">
            <View class="flex-col">
              <Text class="text-sm text-slate-100 font-bold">{name.value}</Text>
              <Text class="text-xs text-slate-400">{condition.value.replace(/_/g, " ")}</Text>
            </View>
            <View class="flex-row items-end gap-1">
              <Text class="text-3xl text-slate-50 font-bold">
                {temp.value != null ? String(temp.value) : "—"}
              </Text>
              <Text class="text-lg text-slate-400">{"\u00b0"}</Text>
            </View>
          </View>
          <View class="flex-row gap-3">
            {humidity.value != null ? (
              <Badge label={`${humidity.value}% humidity`} variant="default" />
            ) : null}
            {wind.value != null ? <Badge label={`${wind.value} km/h`} variant="default" /> : null}
          </View>
        </View>
      ) : null}

      {showForecast && forecast.value.length > 0 ? (
        <View class="flex-col gap-1 px-3 pb-3">
          {forecast.value.slice(0, 5).map((f, i) => {
            const day = f.datetime
              ? new Date(f.datetime).toLocaleDateString("en", { weekday: "short" })
              : `Day ${i + 1}`;
            const cond = f.condition ?? "";
            const mdi = WEATHER_CONDITION_ICONS[cond] ?? "weather-cloudy";
            return (
              <View key={`fc-${i}`} class="flex-row items-center justify-between px-1 py-1">
                <Text class="text-xs text-slate-300" style={{ width: 36 }}>
                  {day}
                </Text>
                <HaIcon icon={`mdi:${mdi}`} size={16} />
                <Text class="text-xs text-slate-400">
                  {f.templow != null ? `${f.templow}\u00b0` : ""}
                </Text>
                <Text class="text-xs text-slate-100 font-bold">
                  {f.temperature != null ? `${f.temperature}\u00b0` : "—"}
                </Text>
                {f.precipitation_probability != null ? (
                  <Text class="text-xs text-blue-400">{f.precipitation_probability}%</Text>
                ) : (
                  <Text class="text-xs text-slate-600">{"  "}</Text>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </Focusable>
  );
}
