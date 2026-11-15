import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { signedLogoUrl } from "@/lib/institute-logo";
import { getParent, getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<p className="p-4 text-slate">{t("Loading…")}</p>}>
      <StaffFrame>{children}</StaffFrame>
    </Suspense>
  );
}

async function StaffFrame({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const staff = await getStaff();
  if (!staff) {
    const parent = await getParent();
    redirect(parent ? "/family" : "/sign-in");
  }

  const logoUrl = await signedLogoUrl(staff.institute.logo_path);

  return (
    <AppShell
      instituteName={staff.institute.name}
      logoUrl={logoUrl}
      sideItems={[
        { href: "/dashboard", label: t("Overview"), exact: true },
        { href: "/students", label: t("Students") },
        { href: "/attendance", label: t("Attendance") },
        { href: "/courses", label: t("Courses") },
        { href: "/payments", label: t("Payments") },
      ]}
      bottomItems={[
        { href: "/students", label: t("Students"), icon: "students" },
        { href: "/attendance", label: t("Attendance"), icon: "attendance" },
        { href: "/courses", label: t("Courses"), icon: "courses" },
        { href: "/payments", label: t("Payments"), icon: "payments" },
      ]}
      settings={{ href: "/settings", label: t("Settings"), mobileLabel: t("More") }}
      homeHref="/dashboard"
    >
      {children}
    </AppShell>
  );
}
