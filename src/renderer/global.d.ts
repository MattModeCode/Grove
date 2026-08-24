import type { GroveBridge } from '../preload/preload';

declare global {
  interface Window {
    grove: GroveBridge;
  }
}

export {};
