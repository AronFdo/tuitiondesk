// Scans taken while the internet is down wait in the browser and are sent
// when it comes back, with the time they were really scanned.

export type QueuedScan = {
  token: string;
  scannedAt: string;
  source: "scanner" | "camera";
};

const MAX_QUEUED = 500;

export function queueKey(sessionId: string) {
  return `td-scan-queue:${sessionId}`;
}

export function readQueue(storage: Pick<Storage, "getItem"> | null, sessionId: string): QueuedScan[] {
  if (!storage) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(storage.getItem(queueKey(sessionId)) ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is QueuedScan =>
        typeof item === "object" &&
        item !== null &&
        typeof item.token === "string" &&
        typeof item.scannedAt === "string" &&
        (item.source === "scanner" || item.source === "camera"),
    );
  } catch {
    return [];
  }
}

export function writeQueue(
  storage: Pick<Storage, "setItem" | "removeItem"> | null,
  sessionId: string,
  queue: QueuedScan[],
) {
  if (!storage) {
    return false;
  }
  try {
    if (queue.length === 0) {
      storage.removeItem(queueKey(sessionId));
    } else {
      storage.setItem(queueKey(sessionId), JSON.stringify(queue.slice(-MAX_QUEUED)));
    }
    return true;
  } catch {
    return false;
  }
}

// One entry per card: scanning the same card twice offline is one arrival,
// at the first time it was scanned.
export function addToQueue(queue: QueuedScan[], scan: QueuedScan): QueuedScan[] {
  if (queue.some((item) => item.token === scan.token)) {
    return queue;
  }
  return [...queue, scan].slice(-MAX_QUEUED);
}
