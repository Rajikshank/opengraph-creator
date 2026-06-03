import type { LayerStyleEffect } from "@opengraph-creator/core";

export interface EffectWorkerRequest {
  width: number;
  height: number;
  effects: LayerStyleEffect[];
  cacheKey: string;
}

export interface EffectWorkerResponse {
  cacheKey: string;
  supported: boolean;
}

export function canUseEffectWorker(): boolean {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
}

export function createEffectWorkerRequest(width: number, height: number, effects: LayerStyleEffect[], cacheKey: string): EffectWorkerRequest {
  return { width, height, effects, cacheKey };
}
