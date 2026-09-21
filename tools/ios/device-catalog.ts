import { readFileSync } from "node:fs";
import type { Viewport } from "../../node_modules/@pocketjs/framework/contracts/spec/platforms.ts";
import { IOS_PRODUCT_CATALOG } from "./paths.ts";

export type DeviceFamily = "iphone" | "ipad" | "ipod";

interface CatalogProduct {
  readonly family: DeviceFamily;
  readonly label: string;
  readonly legacyLogical: [number, number];
}

interface ProductCatalog {
  readonly schema: number;
  readonly familyFallbacks: Record<
    DeviceFamily,
    { readonly legacyLogical: [number, number]; readonly label: string }
  >;
  readonly products: Record<string, CatalogProduct>;
}

let cached: ProductCatalog | undefined;

export function loadProductCatalog(): ProductCatalog {
  if (cached) return cached;
  const path = IOS_PRODUCT_CATALOG;
  cached = JSON.parse(readFileSync(path, "utf8")) as ProductCatalog;
  return cached;
}

export function inferFamily(productType: string): DeviceFamily {
  if (productType.startsWith("iPad")) return "ipad";
  if (productType.startsWith("iPod")) return "ipod";
  return "iphone";
}

export function lookupDeviceProfile(productType: string): {
  readonly productType: string;
  readonly family: DeviceFamily;
  readonly label: string;
  readonly legacyLogical: Viewport;
} {
  const catalog = loadProductCatalog();
  const known = catalog.products[productType];
  if (known) {
    return {
      productType,
      family: known.family,
      label: known.label,
      legacyLogical: [known.legacyLogical[0], known.legacyLogical[1]],
    };
  }
  const family = inferFamily(productType);
  const fallback = catalog.familyFallbacks[family];
  return {
    productType,
    family,
    label: `${fallback.label} (${productType})`,
    legacyLogical: [fallback.legacyLogical[0], fallback.legacyLogical[1]],
  };
}
