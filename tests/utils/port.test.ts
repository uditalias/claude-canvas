import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "net";
import { findAvailablePort } from "../../src/utils/port.js";

function listenOn(host: string, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.once("listening", () => resolve(server));
    server.listen(port, host);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe("findAvailablePort", () => {
  const openServers: Server[] = [];

  afterEach(async () => {
    while (openServers.length) {
      await closeServer(openServers.pop()!);
    }
  });

  it("returns the preferred port when it is free (default host)", async () => {
    // Pick a random high port unlikely to collide
    const preferred = 45000 + Math.floor(Math.random() * 1000);
    const port = await findAvailablePort(preferred);
    expect(port).toBe(preferred);
  });

  it("skips to the next free port when the preferred is taken on the same host", async () => {
    const preferred = 46000 + Math.floor(Math.random() * 1000);
    const blocker = await listenOn("127.0.0.1", preferred);
    openServers.push(blocker);

    const port = await findAvailablePort(preferred, "127.0.0.1");
    expect(port).toBeGreaterThan(preferred);
  });

  it("accepts a custom host without throwing", async () => {
    const preferred = 47000 + Math.floor(Math.random() * 1000);
    // 0.0.0.0 is bindable on all common platforms
    const port = await findAvailablePort(preferred, "0.0.0.0");
    expect(port).toBeGreaterThanOrEqual(preferred);
    expect(port).toBeLessThan(preferred + 100);
  });
});
