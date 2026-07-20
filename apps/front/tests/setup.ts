import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

export async function deleteKiosqDb(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<null>();
  const req = indexedDB.deleteDatabase("kiosq");
  req.addEventListener("success", () => resolve(null));
  req.addEventListener("error", () => resolve(null));
  req.addEventListener("blocked", () => {
    setTimeout(() => resolve(null), 50);
  });
  await promise;
}

afterEach(async () => {
  cleanup();
  await deleteKiosqDb();
});
