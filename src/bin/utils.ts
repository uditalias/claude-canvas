import * as http from "http";
import * as https from "https";

export function httpGet(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    }).on("error", reject);
  });
}

export function httpPost(url: string, body: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = http.request(options, (res) => {
      let resp = "";
      res.on("data", (chunk) => (resp += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(resp));
        } catch {
          reject(new Error(`Invalid JSON response: ${resp}`));
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

export function waitForServer(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on("error", retry);
    }
    function retry() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Server did not start in time"));
        return;
      }
      setTimeout(attempt, 200);
    }
    attempt();
  });
}

export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

export function fetchLatestVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get("https://registry.npmjs.org/claude-canvas/latest", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const pkg = JSON.parse(data);
          resolve(pkg.version);
        } catch {
          reject(new Error("Failed to parse npm registry response"));
        }
      });
    }).on("error", reject);
  });
}
