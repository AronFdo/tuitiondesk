import { signOut } from "@/lib/actions/auth";
import { t } from "@/lib/t";

// For someone signed in with no class to open: a teacher whose access was
// removed, or an account that was never added to one. Sending them to
// sign-in would bounce them back here, so they sign out from this page.
export default function NoAccessPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1>{t("No class to open")}</h1>
      <p className="text-slate">
        {t("This account is not part of a class any more. If you still work there, ask the class owner to give you access again.")}
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="press inline-flex h-11 w-full items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
        >
          {t("Sign out")}
        </button>
      </form>
    </div>
  );
}
