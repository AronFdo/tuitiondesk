"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell, type ShellNavItem } from "@/components/app/app-shell";
import { t } from "@/lib/t";

// The parent portal in the same frame as the staff app, with the class's own
// name and logo, and a child switcher once there are two children.
export function PortalShell({
  instituteName,
  logoUrl,
  familyChildren,
  childId,
  children,
}: {
  instituteName: string;
  logoUrl: string | null;
  familyChildren: { id: string; fullName: string }[];
  childId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/family/${childId}`;
  const items: ShellNavItem[] = [
    { href: base, label: t("Home"), exact: true, icon: "home" },
    { href: `${base}/courses`, label: t("Courses"), icon: "courses" },
    { href: `${base}/fees`, label: t("Fees"), icon: "fees" },
  ];
  // The same tab, for another child.
  const section = pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : "";

  return (
    <AppShell
      instituteName={instituteName}
      logoUrl={logoUrl}
      sideItems={items}
      bottomItems={items}
      banner={
        familyChildren.length > 1 ? (
          <nav className="flex gap-2 overflow-x-auto" aria-label={t("Children")}>
            {familyChildren.map((child) => {
              const active = child.id === childId;
              return (
                <Link
                  key={child.id}
                  href={`/family/${child.id}${section}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-9 shrink-0 items-center rounded-full border px-4 text-sm ${
                    active ? "border-forest bg-forest text-white" : "border-line text-ink"
                  }`}
                >
                  {child.fullName}
                </Link>
              );
            })}
          </nav>
        ) : null
      }
    >
      {children}
    </AppShell>
  );
}
