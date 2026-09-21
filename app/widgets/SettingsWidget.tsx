import { ref } from "vue";
import { View } from "@pocketjs/framework/components";
import {
  FormField,
  Select,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/index.ts";
import { CONFIG } from "../data/config.ts";

type SettingsSection = "display" | "weather" | "location" | "system";

export default function SettingsWidget() {
  const section = ref<SettingsSection>("display");
  const use24h = ref<boolean>(CONFIG.dashboard.use24Hour);
  const showSec = ref<boolean>(CONFIG.dashboard.showSeconds);
  const units = ref(CONFIG.weather.units);

  function setSection(id: string): void {
    section.value = id as SettingsSection;
  }

  function toggle24h(): void {
    use24h.value = !use24h.value;
  }
  function toggleSec(): void {
    showSec.value = !showSec.value;
  }

  return (
    <Tabs value={section.value} onValueChange={setSection}>
      <TabsList>
        <TabsTrigger value="display" label="Display" />
        <TabsTrigger value="weather" label="Weather" />
        <TabsTrigger value="location" label="Location" />
        <TabsTrigger value="system" label="System" />
      </TabsList>

      <TabsContent value="display">
        <View class="flex-col gap-3">
          <FormField label="24-hour clock" horizontal>
            <Switch checked={use24h.value} onPress={toggle24h} />
          </FormField>
          <FormField label="Show seconds" horizontal>
            <Switch checked={showSec.value} onPress={toggleSec} />
          </FormField>
        </View>
      </TabsContent>

      <TabsContent value="weather">
        <View class="flex-col gap-2">
          <Select
            label="Temperature"
            value={units.value}
            options={[
              { value: "metric", label: "Celsius" },
              { value: "imperial", label: "Fahrenheit" },
            ]}
            onValueChange={(v) => {
              units.value = v as "metric" | "imperial";
            }}
          />
        </View>
      </TabsContent>

      <TabsContent value="location">
        <View class="flex-col gap-2">
          <FormField label="City">
            <Select
              value="city"
              options={[{ value: "city", label: CONFIG.location.city }]}
              onValueChange={() => {}}
            />
          </FormField>
          <FormField label="Country">
            <Select
              value="country"
              options={[{ value: "country", label: CONFIG.location.country }]}
              onValueChange={() => {}}
            />
          </FormField>
        </View>
      </TabsContent>

      <TabsContent value="system">
        <View class="flex-col gap-2">
          <Select
            label="Runtime"
            value="pocket"
            options={[{ value: "pocket", label: "PocketJS" }]}
            onValueChange={() => {}}
          />
          <Select
            label="Framework"
            value="vapor"
            options={[{ value: "vapor", label: "Vue Vapor" }]}
            onValueChange={() => {}}
          />
          <Select
            label="Version"
            value="v"
            options={[{ value: "v", label: "0.1.0" }]}
            onValueChange={() => {}}
          />
        </View>
      </TabsContent>
    </Tabs>
  );
}
