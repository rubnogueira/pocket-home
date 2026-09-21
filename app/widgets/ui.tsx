import { Text, View, Focusable } from "@pocketjs/framework/components";
import { Badge } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";
import { ListItem } from "../ui/ListItem.tsx";
import { Switch } from "../ui/Switch.tsx";
import { MENU_ROW_ACTIVE, MENU_ROW_INACTIVE } from "../ui/tokens.ts";

export interface ToggleSwitchProps {
  on: boolean;
  onPress: () => void;
}

export function ToggleSwitch(props: ToggleSwitchProps) {
  return <Switch checked={props.on} onPress={props.onPress} />;
}

// ── Pill Button (small action button) ────────────────────────────────────

export interface PillButtonProps {
  label: string;
  onPress: () => void;
  active?: boolean;
}

export function PillButton(props: PillButtonProps) {
  return (
    <Button
      label={props.label}
      onPress={props.onPress}
      variant="secondary"
      size="sm"
      active={props.active}
    />
  );
}

// ── Menu Button (sidebar navigation item) ────────────────────────────────

export interface MenuButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function MenuButton(props: MenuButtonProps) {
  return (
    <Focusable class={props.active ? MENU_ROW_ACTIVE : MENU_ROW_INACTIVE} onPress={props.onPress}>
      <View
        class={
          props.active ? "w-2 h-2 rounded-full bg-blue-400" : "w-2 h-2 rounded-full bg-slate-500"
        }
      />
      <View style={{ width: 12 }} />
      <Text class={props.active ? "text-sm text-slate-50 font-bold" : "text-sm text-slate-300"}>
        {props.label}
      </Text>
    </Focusable>
  );
}

// ── Device Row (light/sensor list item with status) ──────────────────────

export interface DeviceRowProps {
  key?: string | number;
  name: string;
  status: string;
  on: boolean;
  onPress: () => void;
}

export function DeviceRow(props: DeviceRowProps) {
  return (
    <ListItem title={props.name} subtitle={props.status} on={props.on} onPress={props.onPress} />
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────

export interface StatusBadgeProps {
  label: string;
  status?: number;
}

function statusVariant(status?: number): "success" | "warning" | "danger" | "default" {
  if (status === 0) return "success";
  if (status === 1) return "warning";
  if (status === 2) return "danger";
  return "default";
}

export function StatusBadge(props: StatusBadgeProps) {
  return <Badge label={props.label} variant={statusVariant(props.status)} />;
}

export const ActionButton = PillButton;
