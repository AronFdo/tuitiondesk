import { SignUpForm } from "@/components/auth/sign-up-form";
import { t } from "@/lib/t";

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg">{t("Create your class")}</h2>
      <SignUpForm />
    </div>
  );
}
