/**
 * Action dispatcher — resolves tap/hold/double-tap actions.
 */

import type { ActionConfig } from "../types/action.ts";
import type { HassEntity } from "../types/entity.ts";
import { entityDomain, TOGGLE_DOMAINS } from "../types/entity.ts";
import type { DataSource } from "./data-source.ts";

export interface ActionContext {
  entity?: HassEntity;
  source: DataSource;
  navigate?: (path: string) => void;
  showMoreInfo?: (entityId: string) => void;
}

export function executeAction(action: ActionConfig | undefined, ctx: ActionContext): void {
  if (!action || action.action === "none") return;

  switch (action.action) {
    case "toggle": {
      if (!ctx.entity) return;
      const domain = entityDomain(ctx.entity.entity_id);
      const service = ctx.entity.state === "on" ? "turn_off" : "turn_on";
      const svcDomain = TOGGLE_DOMAINS.has(domain) ? domain : "homeassistant";
      ctx.source.callService(svcDomain, service, {}, { entity_id: ctx.entity.entity_id });
      break;
    }

    case "call-service":
    case "perform-action": {
      const svc = action.perform_action ?? action.service ?? "";
      const [domain, service] = svc.split(".", 2);
      if (domain && service) {
        ctx.source.callService(domain, service, action.data ?? action.service_data, action.target);
      }
      break;
    }

    case "navigate": {
      if (ctx.navigate) ctx.navigate(action.navigation_path);
      break;
    }

    case "url": {
      // In PocketJS there is no browser — log it.
      console.log("[action] open URL:", action.url_path);
      break;
    }

    case "more-info": {
      const eid = action.entity ?? ctx.entity?.entity_id;
      if (eid && ctx.showMoreInfo) ctx.showMoreInfo(eid);
      break;
    }

    case "assist":
    case "fire-dom-event":
    default:
      break;
  }
}

/** Resolve the default tap_action for an entity. */
export function defaultTapAction(_entity?: HassEntity): ActionConfig {
  return { action: "more-info" };
}

/** Resolve the default hold_action for an entity. */
export function defaultHoldAction(_entity?: HassEntity): ActionConfig {
  return { action: "more-info" };
}
