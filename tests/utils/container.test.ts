import { describe, it, expect } from "vitest";
import { isRunningInContainer, resolveDefaultHost } from "../../src/utils/container.js";

describe("container detection", () => {
  it("detects Docker via /.dockerenv", () => {
    const exists = (p: string) => p === "/.dockerenv";
    expect(isRunningInContainer(exists)).toBe(true);
    expect(resolveDefaultHost(exists)).toBe("0.0.0.0");
  });

  it("detects Podman via /run/.containerenv", () => {
    const exists = (p: string) => p === "/run/.containerenv";
    expect(isRunningInContainer(exists)).toBe(true);
    expect(resolveDefaultHost(exists)).toBe("0.0.0.0");
  });

  it("returns 127.0.0.1 when no container markers are present", () => {
    const exists = () => false;
    expect(isRunningInContainer(exists)).toBe(false);
    expect(resolveDefaultHost(exists)).toBe("127.0.0.1");
  });
});
