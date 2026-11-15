import { AcceptInviteForm } from "@/components/auth/account-forms";
import { t } from "@/lib/t";

export default function AcceptInvitePage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg">{t("Join your class")}</h2>
      <AcceptInviteForm />
    </div>
  );
}
