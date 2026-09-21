/// <reference path="../../node_modules/@pocketjs/framework/framework/src/jsx.d.ts" />

/**
 * Pocket Home augmentations for PocketJS component props (Vue list `key`, etc.).
 */
declare module "@pocketjs/framework/components" {
  interface ViewProps {
    key?: string | number;
  }
  interface TextProps {
    key?: string | number;
  }
  interface FocusableProps {
    key?: string | number;
  }
}

export {};
