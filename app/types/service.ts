/**
 * Service call types.
 */

import type { ServiceTarget } from "./action.ts";

export interface ServiceCallRequest {
  domain: string;
  service: string;
  target?: ServiceTarget;
  data?: Record<string, unknown>;
}

export interface ServiceField {
  name?: string;
  description?: string;
  required?: boolean;
  example?: unknown;
  default?: unknown;
  selector?: Record<string, unknown>;
}

export interface ServiceDefinition {
  name?: string;
  description?: string;
  fields: Record<string, ServiceField>;
  target?: { entity?: { domain?: string | string[] } };
}

export type ServiceDomainMap = Record<string, Record<string, ServiceDefinition>>;
