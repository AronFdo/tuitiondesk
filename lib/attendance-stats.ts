// How often a student came to each of their classes, from the sessions held
// since they joined it.

export type HeldSession = { id: string; courseId: string; heldOn: string };
export type Enrolment = { courseId: string; courseName: string; startDate: string };

export type CourseAttendance = {
  courseId: string;
  courseName: string;
  held: number;
  present: number;
  // Whole percent, or null before any session was held.
  rate: number | null;
  // Newest first.
  sessions: { id: string; heldOn: string; present: boolean }[];
};

export function studentAttendance(
  enrolments: Enrolment[],
  sessions: HeldSession[],
  presentSessionIds: Set<string>,
): CourseAttendance[] {
  return enrolments
    .map((enrolment) => {
      const held = sessions
        .filter((session) => session.courseId === enrolment.courseId && session.heldOn >= enrolment.startDate)
        .sort((a, b) => b.heldOn.localeCompare(a.heldOn))
        .map((session) => ({
          id: session.id,
          heldOn: session.heldOn,
          present: presentSessionIds.has(session.id),
        }));
      const present = held.filter((session) => session.present).length;
      return {
        courseId: enrolment.courseId,
        courseName: enrolment.courseName,
        held: held.length,
        present,
        rate: held.length === 0 ? null : Math.round((present / held.length) * 100),
        sessions: held,
      };
    })
    .sort((a, b) => a.courseName.localeCompare(b.courseName));
}
