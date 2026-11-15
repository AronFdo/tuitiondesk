import Link from "next/link";
import { t } from "@/lib/t";

export const settingsSections = [
  { id: "class", label: t("Class details") },
  { id: "days", label: t("Fee due dates") },
  { id: "receipts", label: t("Receipts") },
  { id: "logo", label: t("Logo") },
  { id: "teachers", label: t("Staff and logins") },
] as const;

export type SettingsSection = (typeof settingsSections)[number]["id"];

export function settingsSection(value: string | undefined): SettingsSection {
  const section = value === "times" ? "days" : value;
  return settingsSections.some((item) => item.id === section)
    ? (section as SettingsSection)
    : "class";
}

export function SettingsNav({
  active,
  sections,
}: {
  active: SettingsSection;
  sections: readonly { id: SettingsSection; label: string }[];
}) {
  return (
    <nav className="md:w-56 md:shrink-0" aria-label={t("Settings")}>
      <ul>
        {sections.map((section) => {
          const selected = section.id === active;
          return (
            <li key={section.id} className="border-b border-line">
              <Link
                href={section.id === "class" ? "/settings" : `/settings?section=${section.id}`}
                className={`flex h-11 items-center text-sm ${selected ? "font-medium text-forest" : "text-ink"}`}
                aria-current={selected ? "page" : undefined}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
