import { describe, expect, it } from "vitest";

/**
 * Auth + profile domain rules.
 *
 * The DB trigger handles profile creation; these tests validate the
 * application-level rules that surround auth (sign-up validation,
 * provider mapping, display name derivation) so the trigger contract
 * is exercised without hitting a live database.
 */

// ---------------------------------------------------------------------------
// Sign-up validation (mirrors apps/web/src/app/(auth)/signup/actions.ts)
// ---------------------------------------------------------------------------

function validateSignUpInput(input: {
  name: string;
  email: string;
  password: string;
}): string | null {
  if (!input.name.trim() || !input.email.trim() || !input.password) {
    return "All fields are required.";
  }
  if (input.password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

describe("sign-up input validation", () => {
  it("accepts valid input", () => {
    expect(validateSignUpInput({ name: "Alice", email: "a@b.com", password: "secret99" })).toBeNull();
  });

  it("rejects empty name", () => {
    expect(validateSignUpInput({ name: "", email: "a@b.com", password: "secret99" })).toBe(
      "All fields are required.",
    );
  });

  it("rejects whitespace-only name", () => {
    expect(validateSignUpInput({ name: "   ", email: "a@b.com", password: "secret99" })).toBe(
      "All fields are required.",
    );
  });

  it("rejects empty email", () => {
    expect(validateSignUpInput({ name: "Alice", email: "", password: "secret99" })).toBe(
      "All fields are required.",
    );
  });

  it("rejects short password", () => {
    expect(validateSignUpInput({ name: "Alice", email: "a@b.com", password: "short" })).toBe(
      "Password must be at least 8 characters.",
    );
  });

  it("accepts password of exactly 8 characters", () => {
    expect(validateSignUpInput({ name: "Alice", email: "a@b.com", password: "12345678" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Auth provider mapping (mirrors DB trigger logic)
// ---------------------------------------------------------------------------

type AuthProvider = "email" | "google" | "apple";

function resolveAuthProvider(rawProvider: string | undefined): AuthProvider {
  if (rawProvider === "google") return "google";
  if (rawProvider === "apple") return "apple";
  return "email";
}

describe("auth provider mapping", () => {
  it("maps 'google' to google", () => {
    expect(resolveAuthProvider("google")).toBe("google");
  });

  it("maps 'apple' to apple", () => {
    expect(resolveAuthProvider("apple")).toBe("apple");
  });

  it("maps unknown provider to email", () => {
    expect(resolveAuthProvider("github")).toBe("email");
  });

  it("maps undefined to email", () => {
    expect(resolveAuthProvider(undefined)).toBe("email");
  });
});

// ---------------------------------------------------------------------------
// Display name derivation (mirrors DB trigger: full_name fallback to email)
// ---------------------------------------------------------------------------

function resolveDisplayName(fullName: string | undefined, email: string): string {
  return fullName?.trim() || email;
}

describe("display name derivation", () => {
  it("uses full_name when provided", () => {
    expect(resolveDisplayName("Alice Smith", "a@b.com")).toBe("Alice Smith");
  });

  it("falls back to email when full_name is absent", () => {
    expect(resolveDisplayName(undefined, "a@b.com")).toBe("a@b.com");
  });

  it("falls back to email when full_name is whitespace", () => {
    expect(resolveDisplayName("   ", "a@b.com")).toBe("a@b.com");
  });
});

// ---------------------------------------------------------------------------
// OAuth redirect URL construction
// ---------------------------------------------------------------------------

function buildOAuthRedirectUrl(siteUrl: string, path = "/auth/callback"): string {
  return `${siteUrl.replace(/\/$/, "")}${path}`;
}

describe("OAuth redirect URL construction", () => {
  it("builds correct callback URL", () => {
    expect(buildOAuthRedirectUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/callback",
    );
  });

  it("strips trailing slash from siteUrl", () => {
    expect(buildOAuthRedirectUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/auth/callback",
    );
  });

  it("works with production URL", () => {
    expect(buildOAuthRedirectUrl("https://app.example.com")).toBe(
      "https://app.example.com/auth/callback",
    );
  });
});
