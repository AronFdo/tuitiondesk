"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SelectField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { openSession } from "@/lib/actions/attendance";
import type { RunnableCourse } from "@/lib/attendance";
import { t } from "@/lib/t";

export function StartAttendance({ courses, today }: { courses: RunnableCourse[]; today: string }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(courses.length === 1 ? courses[0].id : "");
  const [heldOn, setHeldOn] = useState(today);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (courses.length === 0) {
    return <p className="text-slate">{t("You have no classes to take attendance for yet.")}</p>;
  }

  return (
    <form
      className="flex flex-col gap-4 md:flex-row md:items-end"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) {
          return;
        }
        if (!courseId) {
          setError(t("Choose a class."));
          return;
        }
        setPending(true);
        setError(null);
        const result = await openSession({ courseId, heldOn }).catch(() => null);
        if (!result?.ok) {
          setPending(false);
          setError(result?.error ?? t("No connection. Try again."));
          return;
        }
        router.push(`/attendance/${result.data.sessionId}`);
      }}
    >
      <div className="md:w-72">
        <SelectField label={t("Class")} name="courseId" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
          <option value="">{t("Choose")}</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.scheduleText ? `${course.name} · ${course.scheduleText}` : course.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="md:w-44">
        <TextField
          label={t("Day")}
          name="heldOn"
          type="date"
          max={today}
          value={heldOn}
          onChange={(event) => setHeldOn(event.target.value || today)}
        />
      </div>
      <Button type="submit" className="h-11 px-5" disabled={pending}>
        {pending ? t("Starting…") : t("Start attendance")}
      </Button>
      {error ? <p role="alert" className="text-sm text-destructive md:self-center">{error}</p> : null}
    </form>
  );
}
