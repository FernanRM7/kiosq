import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

function deleteKiosqDb(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase("kiosq");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
}

afterEach(async () => {
  cleanup();
  await deleteKiosqDb();
});
