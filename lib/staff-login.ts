import { t } from "@/lib/t";

// Messages for giving a staff member a login (lib/actions/staff.ts). The add
// form redirects to the staff page with ?login=<result>, and the page reads
// the message back from here, so only these fixed texts are ever shown.

export type LoginProblem = "family" | "linked" | "exists" | "failed";

const LOGIN_PROBLEMS: Record<LoginProblem, string> = {
  family: "That email belongs to a parent's account. Use a different email for staff.",
  linked: "That email is already linked to someone else on your staff.",
  exists: "That email already has an account. Ask them to sign in, then try again.",
  failed: "That invite could not be sent.",
};

export function loginProblemText(problem: LoginProblem) {
  return t(LOGIN_PROBLEMS[problem]);
}

export function loginDoneText(invited: boolean) {
  return invited
    ? t("Invite sent. They set a password from the email, then sign in.")
    : t("Done. They can sign in with their existing account.");
}

export function loginResultText(value: string | undefined): { ok: boolean; text: string } | null {
  if (value === "invited" || value === "linked") {
    return { ok: true, text: loginDoneText(value === "invited") };
  }
  if (value && Object.hasOwn(LOGIN_PROBLEMS, value)) {
    return {
      ok: false,
      text: `${t("Saved, but their login could not be set up.")} ${loginProblemText(value as LoginProblem)} ${t("Use Give login access to try again.")}`,
    };
  }
  return null;
}
