"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  CalendarCheck,
  Ellipsis,
  House,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { t } from "@/lib/t";

export type ShellIcon = "home" | "students" | "attendance" | "courses" | "payments" | "fees" | "more";

const ICONS: Record<ShellIcon, LucideIcon> = {
  home: House,
  students: Users,
  attendance: CalendarCheck,
  courses: BookOpen,
  payments: Wallet,
  fees: Wallet,
  more: Ellipsis,
};

export type ShellNavItem = {
  href: string;
  label: string;
  // Shown above the label in the phone tab bar.
  icon?: ShellIcon;
  // Active only on this exact path, not on pages below it (a home page).
  exact?: boolean;
};

function isItemActive(item: ShellNavItem, pathname: string) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// The current page is marked by weight and aria-current as well as colour.
function itemClass(active: boolean, onDark: boolean) {
  if (onDark) {
    return active
      ? "bg-forest-hover font-semibold text-mint-soft"
      : "text-white hover:bg-forest-hover";
  }
  return active ? "font-semibold text-forest" : "text-slate";
}

// The frame shared by the staff app and the parent portal: forest sidebar on
// desktop, forest header and bottom nav on mobile.
export function AppShell({
  instituteName,
  logoUrl,
  sideItems,
  bottomItems,
  settings,
  banner,
  homeHref,
  children,
}: {
  instituteName: string;
  logoUrl: string | null;
  sideItems: ShellNavItem[];
  // The mobile bottom nav; keep it to four or five.
  bottomItems: ShellNavItem[];
  // A last link under the sidebar and at the end of the bottom nav.
  settings?: { href: string; label: string; mobileLabel: string };
  // Shown below the header on every screen, such as the deadline strip.
  banner?: React.ReactNode;
  // Where the class name in the mobile header goes, for a home page that is
  // not in the bottom nav.
  homeHref?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const settingsActive = settings ? pathname.startsWith(settings.href) : false;

  return (
    <div className="min-h-full md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden min-h-screen flex-col bg-forest text-white md:flex">
        <div className="flex items-center gap-3 px-4 py-5">
          <Mark logoUrl={logoUrl} />
          <p className="truncate text-sm font-medium">{instituteName}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label={t("Main")}>
          {sideItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isItemActive(item, pathname) ? "page" : undefined}
              className={`flex h-11 items-center rounded-md px-3 active:bg-forest-hover active:text-mint-soft ${itemClass(isItemActive(item, pathname), true)}`}
            >
              {item.label}
            </Link>
          ))}
          {settings ? (
            <Link
              href={settings.href}
              aria-current={settingsActive ? "page" : undefined}
              className={`flex h-11 items-center rounded-md px-3 active:bg-forest-hover active:text-mint-soft ${itemClass(settingsActive, true)}`}
            >
              {settings.label}
            </Link>
          ) : null}
        </nav>
        <form action={signOut} className="p-3">
          <button
            type="submit"
            className="flex h-11 w-full items-center rounded-md px-3 text-left text-white hover:bg-forest-hover active:bg-forest-hover active:text-mint-soft"
          >
            {t("Sign out")}
          </button>
        </form>
      </aside>

      <div>
        <header className="flex h-14 items-center justify-between gap-3 bg-forest px-4 text-white md:hidden">
          {homeHref ? (
            <Link href={homeHref} className="flex min-w-0 items-center gap-3">
              <Mark logoUrl={logoUrl} />
              <p className="truncate text-sm font-medium">{instituteName}</p>
            </Link>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <Mark logoUrl={logoUrl} />
              <p className="truncate text-sm font-medium">{instituteName}</p>
            </div>
          )}
          <form action={signOut}>
            <button type="submit" className="h-11 px-2 text-sm">
              {t("Sign out")}
            </button>
          </form>
        </header>
        <div className="mx-auto w-full max-w-[1120px] px-4 py-6 pb-24 md:px-8 md:pb-8">
          {banner ? <div className="mb-6">{banner}</div> : null}
          {children}
        </div>
        <nav
          className="chrome-bar fixed inset-x-0 bottom-0 flex h-16 items-stretch border-t border-line md:hidden"
          aria-label={t("Main")}
        >
          {bottomItems.map((item) => (
            <TabLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isItemActive(item, pathname)}
            />
          ))}
          {settings ? (
            <TabLink
              href={settings.href}
              label={settings.mobileLabel}
              icon="more"
              active={settingsActive}
            />
          ) : null}
        </nav>
      </div>
    </div>
  );
}

// A phone tab: icon over a short label, iOS tab-bar style, so five tabs keep
// clear space between their labels even at 320px.
function TabLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon?: ShellIcon;
  active: boolean;
}) {
  const Icon = icon ? ICONS[icon] : null;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[0.6875rem] leading-tight active:bg-mint-soft active:text-forest ${itemClass(active, false)}`}
    >
      {Icon ? <Icon aria-hidden="true" className="size-6" strokeWidth={active ? 2.25 : 1.75} /> : null}
      <span>{label}</span>
    </Link>
  );
}

function Mark({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={32}
        height={32}
        unoptimized
        className="h-8 w-8 rounded-md object-cover"
      />
    );
  }
  return (
    <Image
      src="/brand/asterisk.png"
      alt=""
      width={2000}
      height={2000}
      className="size-7 mix-blend-screen"
    />
  );
}
