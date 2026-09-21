import { computed, ref } from "vue";
import { View } from "@pocketjs/framework/components";
import { Badge, Checkbox, Tabs, TabsList, TabsTrigger } from "../ui/index.ts";
import { NOTES_ROW_ACTIVE, NOTES_ROW_INACTIVE } from "../ui/tokens.ts";

interface NoteEntry {
  id: string;
  text: string;
  done: boolean;
  priority: number;
}

const INITIAL_NOTES: NoteEntry[] = [
  { id: "1", text: "Check HVAC filters", done: false, priority: 0 },
  { id: "2", text: "Water the garden", done: true, priority: 1 },
  { id: "3", text: "Grocery shopping", done: false, priority: 1 },
  { id: "4", text: "Fix kitchen light", done: false, priority: 0 },
  { id: "5", text: "Clean solar panels", done: true, priority: 2 },
  { id: "6", text: "Schedule plumber", done: false, priority: 0 },
];

export default function NotesWidget() {
  const notes = ref<NoteEntry[]>(INITIAL_NOTES);
  const filter = ref<"all" | "active" | "done">("all");

  const total = computed(() => notes.value.length);
  const done = computed(() => notes.value.filter((n) => n.done).length);

  const filtered = computed(() => {
    if (filter.value === "active") return notes.value.filter((n) => !n.done);
    if (filter.value === "done") return notes.value.filter((n) => n.done);
    return notes.value;
  });

  function toggle(id: string): void {
    notes.value = notes.value.map((n) => (n.id === id ? { ...n, done: !n.done } : n));
  }

  function setFilter(id: string): void {
    filter.value = id as "all" | "active" | "done";
  }

  return (
    <View class="flex-col flex-1 gap-2">
      <View class="flex-row items-center justify-between">
        <Badge label={`${done.value}/${total.value} done`} variant="success" />
      </View>

      <Tabs value={filter.value} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all" label="All" />
          <TabsTrigger value="active" label="Active" />
          <TabsTrigger value="done" label="Done" />
        </TabsList>
      </Tabs>

      <View class="flex-col gap-1 flex-1">
        {filtered.value.map((note) => (
          <View
            key={note.id}
            class={note.priority === 0 && !note.done ? NOTES_ROW_ACTIVE : NOTES_ROW_INACTIVE}
          >
            <Checkbox checked={note.done} label={note.text} onPress={() => toggle(note.id)} />
            {!note.done && note.priority === 0 ? <Badge label="High" variant="danger" /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}
