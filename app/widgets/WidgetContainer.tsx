import { View } from "@pocketjs/framework/components";
import { CardHeader } from "../ui/Card.tsx";
import { CARD_BODY_COMPACT, SURFACE_CARD } from "../ui/tokens.ts";

type WidgetComponent = (props?: Record<string, never>) => JSX.Element | null;

export interface WidgetContainerProps {
  width: number;
  height: number;
  title?: string;
  /** Reserved for a future staggered mount animation. */
  animDelay?: number;
  widget: WidgetComponent;
}

export default function WidgetContainer(props: WidgetContainerProps) {
  const Widget = props.widget;

  return (
    <View class={SURFACE_CARD} style={{ width: props.width, height: props.height }}>
      {props.title ? <CardHeader title={props.title} /> : null}
      <View class={CARD_BODY_COMPACT}>
        <Widget />
      </View>
    </View>
  );
}
