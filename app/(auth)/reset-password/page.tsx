import { ResetPasswordForm } from "@/components/auth/account-forms";
import { t } from "@/lib/t";

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg">{t("Choose a new password")}</h2>
      <ResetPasswordForm />
    </div>
  );
}
