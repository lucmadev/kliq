export interface KliqBridge {
  version: string;
}

declare global {
  interface Window {
    kliq: KliqBridge;
  }
}

export {};
