import { t } from "@/lib/t";

export function firstIssue(message: string | undefined) {
  return t(message ?? "Check the form and try again.");
}

export function friendlyAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return t("That email or password is incorrect.");
  }
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered")
  ) {
    return t("That email is already registered. Sign in instead.");
  }
  return t("Something went wrong. Try again.");
}

export function caughtMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : t("Something went wrong. Try again.");
}
