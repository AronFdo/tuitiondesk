import { Suspense } from "react";
import { FileList } from "@/components/courses/file-list";
import { FamilyProblem } from "@/components/family/family-problem";
import { NoticeList } from "@/components/family/notice-list";
import { ReminderList } from "@/components/family/reminder-list";
import { loadFamilyHome } from "@/lib/family";
import { t } from "@/lib/t";

export default function FamilyHomePage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <Home params={params} />
    </Suspense>
  );
}

async function Home({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const page = await loadFamilyHome(childId);
  if (page.status !== "ready") {
    return <FamilyProblem problem={page} />;
  }
  return (
    <div className="flex flex-col gap-8">
      <h1>{page.child.fullName}</h1>
      <section>
        <h2>{t("Reminders")}</h2>
        <ReminderList reminders={page.reminders} />
      </section>
      <section>
        <h2>{t("Notices")}</h2>
        <NoticeList notices={page.notices} empty={t("No notices from the class.")} />
      </section>
      {page.newFiles.length > 0 ? (
        <section>
          <h2>{t("New files")}</h2>
          <FileList
            files={page.newFiles.map((file) => ({
              ...file,
              name: `${file.name} · ${file.courseName}`,
            }))}
            empty=""
          />
        </section>
      ) : null}
    </div>
  );
}
