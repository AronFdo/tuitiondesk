import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cardPath, isCardToken } from "@/lib/student-card";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";

// Where a phone camera lands after scanning a student card. Signed-in staff
// go straight to the student's profile (the database only finds students
// they may see). Everyone else learns what the card is and nothing more:
// no name, no class.

type Params = Promise<{ token: string }>;

export default function CardPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <Card params={params} />
    </Suspense>
  );
}

async function Card({ params }: { params: Params }) {
  const token = (await params).token.toLowerCase();
  if (!isCardToken(token)) {
    return <Message title={t("Not a TuitionDesk card")} body={t("This link does not belong to a student card.")} />;
  }

  const staff = await getStaff();
  if (staff) {
    const { data: student } = await (await createClient())
      .from("students")
      .select("id, status")
      .eq("institute_id", staff.institute.id)
      .eq("qr_token", token)
      .maybeSingle();
    if (student && student.status !== "archived") {
      redirect(`/students/${student.id}`);
    }
    return (
      <Message
        title={t("Card not recognised")}
        body={t("This card is not for a student you can see. It may have been replaced by a newer card, or belong to another class.")}
        action={{ href: "/students", label: t("Open students") }}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <Message
      title={t("TuitionDesk student card")}
      body={t("Show this card at the class desk to check in.")}
      action={
        user
          ? undefined
          : { href: `/sign-in?next=${encodeURIComponent(cardPath(token))}`, label: t("Staff sign in") }
      }
    />
  );
}

function Message({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1>{title}</h1>
      <p className="text-slate">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
