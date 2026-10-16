import type { KliqBridge } from "./index";

declare global {
  interface Window {
    kliq: KliqBridge;
  }
}

export {};
