import { describe, expect, it } from "vitest";
import { registerSchema } from "./schema";

const valid = {
  username: "validuser",
  password: "longenough10",
  confirmPassword: "longenough10",
};

describe("registerSchema", () => {
  it("parses a valid payload and trims the username", () => {
    const result = registerSchema.safeParse({
      ...valid,
      username: "  spaced_name  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("spaced_name");
    }
  });

  it("rejects a username shorter than 5 characters", () => {
    const result = registerSchema.safeParse({ ...valid, username: "abcd" });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.path).toEqual(["username"]);
      expect(issue.message).toBe("Username must be at least 5 characters");
    }
  });

  it("rejects a username longer than 20 characters", () => {
    const result = registerSchema.safeParse({
      ...valid,
      username: "a".repeat(21),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.path).toEqual(["username"]);
      expect(issue.message).toBe("Username must not exceed 20 characters");
    }
  });

  it("rejects a username containing spaces", () => {
    const result = registerSchema.safeParse({
      ...valid,
      username: "has space",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.path).toEqual(["username"]);
      expect(issue.message).toBe(
        "Username must be alphanumeric with no spaces",
      );
    }
  });

  it("rejects a username with disallowed symbols, allowing only alphanumeric/underscore/hyphen", () => {
    for (const username of [
      "bad!name",
      "user@name",
      "dot.name",
      "white$pace",
    ]) {
      const result = registerSchema.safeParse({ ...valid, username });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue.path).toEqual(["username"]);
        expect(issue.message).toBe(
          "Username must be alphanumeric with no spaces",
        );
      }
    }

    // underscores and hyphens are permitted
    expect(
      registerSchema.safeParse({ ...valid, username: "good_user-name" })
        .success,
    ).toBe(true);
  });

  it("rejects a password shorter than 10 characters", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "short",
      confirmPassword: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.length === 1 && i.path[0] === "password",
      );
      expect(issue?.message).toBe("Password must be at least 10 characters");
    }
  });

  it("rejects a password longer than 255 characters", () => {
    const long = "a".repeat(256);
    const result = registerSchema.safeParse({
      ...valid,
      password: long,
      confirmPassword: long,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.length === 1 && i.path[0] === "password",
      );
      expect(issue?.message).toBe("Password must not exceed 255 characters");
    }
  });

  it("reports a mismatched confirmPassword on the confirmPassword path", () => {
    const result = registerSchema.safeParse({
      ...valid,
      confirmPassword: "different10chars",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.path).toEqual(["confirmPassword"]);
      expect(issue.message).toBe("Password does not match");
    }
  });
});
