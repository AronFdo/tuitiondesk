import { NoticeBoard } from "@/components/courses/notice-board";
import { loadNotices } from "@/lib/notices";

// Loads its own notices so the page around it does not wait on them.
export async function NoticeSection({
  courseId,
  canManage,
}: {
  courseId: string | null;
  canManage: boolean;
}) {
  const result = await loadNotices(courseId);
  if (!result.ok) {
    // Before 017_family_portal.sql has run there is nothing to show.
    return null;
  }
  return <NoticeBoard courseId={courseId} canManage={canManage} notices={result.notices} />;
}
