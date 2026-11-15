import { ForgotPasswordForm } from "@/components/auth/account-forms";
import { t } from "@/lib/t";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg">{t("Reset password")}</h2>
      <ForgotPasswordForm />
    </div>
  );
}
