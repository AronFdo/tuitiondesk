"use client";

import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelClassName } from "@/components/ui/form-dialog";
import { DueDayField } from "@/components/form/due-day-field";
import { SelectField, TextAreaField, TextField } from "@/components/form/text-field";
import { createCourse, updateCourse } from "@/lib/actions/courses";
import { courseDays } from "@/lib/schedule";
import { t } from "@/lib/t";
import type { CourseInput } from "@/lib/validation/course";
import type { TeacherOption } from "@/lib/class-courses";

const emptyCourse: CourseInput = {
  name: "",
  level: "",
  teacherProfileId: "",
  scheduleDay: "",
  scheduleTime: "",
  monthlyFee: "",
  tuitionDueDay: "",
  description: "",
};

export function CourseForm({
  teachers,
  courseId,
  defaults,
  onDone,
  onCancel,
}: {
  teachers: TeacherOption[];
  courseId?: string;
  defaults?: CourseInput;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const form = useForm<CourseInput>({
    defaultValues: defaults ?? emptyCourse,
  });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void form.handleSubmit(async (values) => {
          if (saving.current) {
            return;
          }
          saving.current = true;
          setError(null);
          setPending(true);
          const result = courseId
            ? await updateCourse({ ...values, courseId })
            : await createCourse(values);
          saving.current = false;
          setPending(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (courseId) {
            onDone?.();
            router.refresh();
            return;
          }
          if (result.data && "id" in result.data) {
            router.push(`/courses/${result.data.id}`);
          }
          router.refresh();
        })(event);
      }}
    >
      <TextField label={t("Course name")} placeholder="Grade 6 English" {...form.register("name")} />
      <TextField
        label={t("Level (optional)")}
        placeholder="Grade 6"
        maxLength={60}
        {...form.register("level")}
      />
      <SelectField label={t("Teacher")} {...form.register("teacherProfileId")}>
        <option value="">{t("No teacher yet")}</option>
        {teachers.map((teacher) => (
          <option key={teacher.id} value={teacher.id}>
            {teacher.name}
          </option>
        ))}
      </SelectField>
      <SelectField label={t("Day")} {...form.register("scheduleDay")}>
        <option value="">{t("Choose a day")}</option>
        {courseDays.map((day) => (
          <option key={day} value={day}>
            {t(day)}
          </option>
        ))}
      </SelectField>
      <TextField label={t("Time")} type="time" step={60} {...form.register("scheduleTime")} />
      <TextField
        label={t("Monthly fee")}
        inputMode="decimal"
        placeholder="12500"
        {...form.register("monthlyFee")}
      />
      <Controller
        control={form.control}
        name="tuitionDueDay"
        render={({ field }) => (
          <DueDayField
            label={t("Tuition due")}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      <TextAreaField label={t("Description")} {...form.register("description")} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3">
        <button type="button" className={cancelClassName()} disabled={pending} onClick={onCancel}>
          {t("Cancel")}
        </button>
        <Button type="submit" className="h-11 flex-1" disabled={pending}>
          {pending ? t("Saving…") : courseId ? t("Save") : t("Add course")}
        </Button>
      </div>
    </form>
  );
}
