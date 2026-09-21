import { Text, View } from "@pocketjs/framework/components";
import type { UiChildren } from "./children.ts";
import type { NodeMirror } from "@pocketjs/framework/components";
import {
  CARD_BODY,
  CARD_BODY_COMPACT,
  CARD_DESCRIPTION,
  CARD_FOOTER,
  CARD_HEADER,
  CARD_WIDGET_TITLE,
  SURFACE_CARD,
} from "./tokens.ts";
import { Separator } from "./Separator.tsx";

type StyleObject = Record<string, number | string>;

export interface CardProps {
  style?: StyleObject;
  nodeRef?: (node: NodeMirror | null) => void;
  children?: UiChildren;
}

export interface CardBodyProps {
  compact?: boolean;
  children?: UiChildren;
}

export interface CardTitleProps {
  children?: UiChildren;
}

export interface CardHeaderProps {
  title?: string;
  description?: string;
  children?: UiChildren;
}

export interface CardFooterProps {
  children?: UiChildren;
}

export function Card(props: CardProps) {
  return (
    <View nodeRef={props.nodeRef} class={SURFACE_CARD} style={props.style}>
      {props.children}
    </View>
  );
}

export function CardHeader(props: CardHeaderProps) {
  return (
    <View class="flex-col">
      <View class={CARD_HEADER}>
        {props.title ? <Text class={CARD_WIDGET_TITLE}>{props.title}</Text> : null}
        {props.children}
      </View>
      {props.description ? (
        <View class="px-3 pb-2">
          <Text class={CARD_DESCRIPTION}>{props.description}</Text>
        </View>
      ) : null}
      <Separator />
    </View>
  );
}

export function CardBody(props: CardBodyProps) {
  return <View class={props.compact ? CARD_BODY_COMPACT : CARD_BODY}>{props.children}</View>;
}

export function CardFooter(props: CardFooterProps) {
  return (
    <View class="flex-col">
      <Separator />
      <View class={CARD_FOOTER}>{props.children}</View>
    </View>
  );
}

export function CardTitle(props: CardTitleProps) {
  return (
    <Text class="text-xs text-slate-500 font-bold tracking-wide uppercase px-1">
      {props.children}
    </Text>
  );
}

export function CardDescription(props: { children?: UiChildren }) {
  return <Text class={CARD_DESCRIPTION}>{props.children}</Text>;
}
