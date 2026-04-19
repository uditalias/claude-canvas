import * as fs from "fs";

// Filesystem markers created by container runtimes. Checking for file existence
// is fast and reliable — no need to parse /proc/1/cgroup.
export const CONTAINER_MARKERS = ["/.dockerenv", "/run/.containerenv"];

type ExistsFn = (path: string) => boolean;

export function isRunningInContainer(exists: ExistsFn = safeExists): boolean {
  return CONTAINER_MARKERS.some((marker) => exists(marker));
}

export function resolveDefaultHost(exists: ExistsFn = safeExists): string {
  return isRunningInContainer(exists) ? "0.0.0.0" : "127.0.0.1";
}

function safeExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}
