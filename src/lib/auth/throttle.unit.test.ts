import { describe, expect, it } from "vitest";

import {
  clientAddress,
  loginAttemptAllowed,
  recordLoginFailure,
  registrationAllowed,
  recordRegistration,
  resetAuthThrottle,
} from "@/lib/auth/throttle";

describe("authentication throttle", () => {
  it("uses the platform-appended address", () => {
    expect(clientAddress(null)).toBe("unknown");
    expect(clientAddress("1.1.1.1, 2.2.2.2")).toBe("2.2.2.2");
  });

  it("blocks an email after repeated failures and ignores address spoofing of the same account", () => {
    resetAuthThrottle();
    const now = 1_000_000;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(loginAttemptAllowed("Ada@Example.test", `10.0.0.${attempt}`, now)).toBe(true);
      recordLoginFailure("Ada@Example.test", `10.0.0.${attempt}`, now);
    }
    expect(loginAttemptAllowed("ada@example.test", "9.9.9.9", now)).toBe(false);
    expect(loginAttemptAllowed("other@example.test", "9.9.9.9", now)).toBe(true);
  });

  it("allows the same email again after the window", () => {
    resetAuthThrottle();
    const now = 1_000_000;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      recordLoginFailure("ada@example.test", "2.2.2.2", now);
    }
    expect(loginAttemptAllowed("ada@example.test", "2.2.2.2", now + 15 * 60 * 1000)).toBe(true);
  });

  it("limits registration attempts from one address", () => {
    resetAuthThrottle();
    const now = 5_000;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(registrationAllowed("2.2.2.2", now)).toBe(true);
      recordRegistration("2.2.2.2", now);
    }
    expect(registrationAllowed("2.2.2.2", now)).toBe(false);
    expect(registrationAllowed("3.3.3.3", now)).toBe(true);
  });
});