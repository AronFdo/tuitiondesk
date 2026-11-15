import { formatDate } from "@/lib/dates";
import type { FamilyNotice } from "@/lib/family";
import { t } from "@/lib/t";

export function NoticeList({
  notices,
  empty,
  showCourse = true,
}: {
  notices: FamilyNotice[];
  empty: string;
  showCourse?: boolean;
}) {
  if (notices.length === 0) {
    return <p className="mt-2 text-slate">{empty}</p>;
  }
  return (
    <ul className="mt-2">
      {notices.map((notice) => (
        <li key={notice.id} className="flex flex-col gap-1 border-b border-line py-3">
          <p className="whitespace-pre-line text-ink">{notice.body}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm text-slate">
            {notice.isNew ? (
              <span className="rounded-md bg-[var(--status-paid-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-paid-fg)]">
                {t("New")}
              </span>
            ) : null}
            {showCourse ? <span>{notice.courseName ?? t("Whole class")}</span> : null}
            <span>
              {showCourse ? "· " : ""}
              {formatDate(notice.postedOn)}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}
