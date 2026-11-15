import { SignInForm } from "@/components/auth/sign-in-form";
import { t } from "@/lib/t";

export default function SignInPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1>{t("Sign in")}</h1>
      <SignInForm />
    </div>
  );
}
