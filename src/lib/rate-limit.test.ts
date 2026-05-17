import { describe, expect, it } from "vitest";
import { takeToken } from "@/lib/rate-limit";

describe("takeToken", () => {
  it("allows requests up to the cap within the window", () => {
    const key = `t-${Math.random().toString(36).slice(2)}`;
    expect(takeToken(key, 3, 60_000).ok).toBe(true);
    expect(takeToken(key, 3, 60_000).ok).toBe(true);
    expect(takeToken(key, 3, 60_000).ok).toBe(true);
    const fourth = takeToken(key, 3, 60_000);
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(fourth.retryAfterSec).toBeGreaterThan(0);
    }
  });
});
