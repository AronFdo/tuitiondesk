import { describe, expect, it } from "vitest";
import { addToQueue, readQueue, writeQueue, type QueuedScan } from "../lib/scan-queue";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

const scan = (token: string, scannedAt = "2026-11-10T08:00:00.000Z"): QueuedScan => ({
  token,
  scannedAt,
  source: "scanner",
});

describe("scan queue", () => {
  it("keeps one entry per card, at the first scan", () => {
    const queue = addToQueue(addToQueue([], scan("a")), scan("a", "2026-11-10T09:00:00.000Z"));
    expect(queue).toEqual([scan("a")]);
  });

  it("round-trips through storage and clears when empty", () => {
    const storage = memoryStorage();
    writeQueue(storage, "s1", [scan("a"), scan("b")]);
    expect(readQueue(storage, "s1")).toEqual([scan("a"), scan("b")]);
    expect(readQueue(storage, "s2")).toEqual([]);
    writeQueue(storage, "s1", []);
    expect(storage.data.size).toBe(0);
  });

  it("survives junk and missing storage", () => {
    const storage = memoryStorage();
    storage.setItem("td-scan-queue:s1", "{not json");
    expect(readQueue(storage, "s1")).toEqual([]);
    storage.setItem("td-scan-queue:s1", JSON.stringify([{ token: 1 }, scan("ok")]));
    expect(readQueue(storage, "s1")).toEqual([scan("ok")]);
    expect(readQueue(null, "s1")).toEqual([]);
    expect(writeQueue(null, "s1", [])).toBe(false);
  });
});
