import { Text, View } from "@pocketjs/framework/components";
import { AVATAR_SHELL, AVATAR_TEXT } from "./tokens.ts";

export interface AvatarProps {
  label: string;
}

export function Avatar(props: AvatarProps) {
  const initials = props.label
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <View class={AVATAR_SHELL}>
      <Text class={AVATAR_TEXT}>{initials}</Text>
    </View>
  );
}
