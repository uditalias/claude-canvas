import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

declare const PACKAGE_VERSION: string;

// Resolve the directory of this file in both CJS (esbuild bundle) and ESM (tsx dev) contexts.
// The indirect eval prevents esbuild from statically analyzing import.meta in CJS output.
export function getCurrentDir(): string {
  if (typeof __dirname !== "undefined") return __dirname;
  // ESM fallback for dev/test (tsx)
  const { fileURLToPath } = require("node:url");
  const meta = (0, eval)("import.meta");
  return dirname(fileURLToPath(meta.url));
}

// PACKAGE_VERSION is injected by esbuild at build time.
// Falls back to reading package.json for dev/test (tsx).
export function getVersion(): string {
  if (typeof PACKAGE_VERSION !== "undefined") return PACKAGE_VERSION;
  try {
    const pkg = JSON.parse(readFileSync(resolve(getCurrentDir(), "../../package.json"), "utf-8"));
    return pkg.version;
  } catch {
    return "0.0.0-dev";
  }
}
