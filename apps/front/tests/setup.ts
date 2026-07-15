import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

export function deleteKiosqDb(): Promise<void> {
  return new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("kiosq");
    req.addEventListener("success", () => resolve());
    req.addEventListener("error", () => resolve());
    // Si Dexie deja conexiones abiertas, onblocked puede impedir
    // que la promesa resuelva. Timeout corto como fallback.
    req.addEventListener("blocked", () => {
      setTimeout(() => resolve(), 50);
    });
  });
}

afterEach(async () => {
  cleanup();
  await deleteKiosqDb();
});
