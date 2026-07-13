import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const als = new AsyncLocalStorage<{ correlationId: string }>();

export function getCorrelationId(): string {
  return als.getStore()?.correlationId ?? "-";
}

export function runCorrelationContext<T>(correlationId: string, fn: () => T): T {
  return als.run({ correlationId }, fn);
}

export function generateCorrelationId(): string {
  return randomUUID();
}

export function cid(): string {
  return `[cid:${getCorrelationId()}]`;
}
