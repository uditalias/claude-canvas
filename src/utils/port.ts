import * as net from "net";

export async function findAvailablePort(preferred = 7890): Promise<number> {
  for (let port = preferred; port < preferred + 100; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error("No available port found in range");
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}
