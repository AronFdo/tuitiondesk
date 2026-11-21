"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import Link from "next/link";
import { useForm, useWatch, type Path } from "react-hook-form";
import { useRouter } from "next/navigation";
import { SelectField, TextAreaField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { createStudent, updateStudentDetails } from "@/lib/actions/students";
import { colomboToday } from "@/lib/dates";
import {
  emptyStudent,
  LEARNING_MODES,
  MEDIUMS,
  RELIGIONS,
  studentSchema,
  type StudentInput,
} from "@/lib/student-fields";
import { COURSE_OUTCOMES } from "@/lib/course-history";
import { t } from "@/lib/t";

// The full student record, on its own page: too many fields for a sheet.
// Every rule lives in studentSchema; errors show beside their fields and the
// first one takes focus.
export function StudentForm({
  studentId,
  defaults,
  courses,
  initialCourseIds = [],
  cancelHref,
}: {
  // Set when editing; adding otherwise.
  studentId?: string;
  defaults?: StudentInput;
  // Courses to tick. When adding, the new student starts on them; when
  // editing, unticked courses end today and newly ticked ones start today.
  courses?: { id: string; name: string }[];
  initialCourseIds?: string[];
  cancelHref: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [courseIds, setCourseIds] = useState<string[]>(initialCourseIds);
  // Why each course the student was on is ending, for courses unticked here.
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const ending = studentId
    ? (courses ?? []).filter(
        (course) => initialCourseIds.includes(course.id) && !courseIds.includes(course.id),
      )
    : [];
  const saving = useRef(false);
  const form = useForm<StudentInput>({
    defaultValues: defaults ?? { ...emptyStudent, startDate: colomboToday() },
  });
  const {
    formState: { errors },
  } = form;
  const hasSpecialNeeds = useWatch({ control: form.control, name: "hasSpecialNeeds" });
  const religion = useWatch({ control: form.control, name: "religion" });
  const errorOf = (name: Path<StudentInput>) => {
    const message = errors[name as keyof StudentInput]?.message;
    return typeof message === "string" ? t(message) : undefined;
  };
  // The id and error for a field; register() stays inline beside it.
  const meta = (name: Path<StudentInput>) => ({ id: `student-${name}`, error: errorOf(name) });

  async function submit(values: StudentInput) {
    if (saving.current) {
      return;
    }
    form.clearErrors();
    const parsed = studentSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        form.setError(issue.path[0] as Path<StudentInput>, { message: issue.message });
      }
      form.setFocus(parsed.error.issues[0].path[0] as Path<StudentInput>);
      setError(t("Some details need fixing. They are marked below."));
      return;
    }
    saving.current = true;
    setError(null);
    setPending(true);
    const result = studentId
      ? await updateStudentDetails({
          studentId,
          student: values,
          courseIds: courses ? courseIds : undefined,
          outcomes: Object.fromEntries(
            ending
              .map((course) => [course.id, outcomes[course.id] ?? ""] as const)
              .filter(([, outcome]) => outcome),
          ),
        }).catch(() => null)
      : await createStudent({ student: values, courseIds }).catch(() => null);
    saving.current = false;
    setPending(false);
    if (!result?.ok) {
      setError(result?.error ?? t("No connection. Nothing was saved. Try again when you are back online."));
      return;
    }
    const target = studentId ?? (result.data as { studentId: string }).studentId;
    router.push(`/students/${target}`);
    router.refresh();
  }

  return (
    <form className="flex max-w-2xl flex-col gap-10" noValidate onSubmit={(event) => void form.handleSubmit(submit)(event)}>
      <Section title={t("Student")}>
        <TextField label={t("First name")} autoComplete="off" required {...form.register("firstName")} {...meta("firstName")} />
        <TextField label={t("Last name")} autoComplete="off" {...form.register("lastName")} {...meta("lastName")} />
        <TextField label={t("Date of birth")} type="date" max={colomboToday()} required {...form.register("dateOfBirth")} {...meta("dateOfBirth")} />
        <TextField
          label={t("Start date")}
          hint={t("When they started at the institute.")}
          type="date"
          required
          {...form.register("startDate")} {...meta("startDate")}
        />
        <SelectField label={t("Gender")} required {...form.register("gender")} {...meta("gender")}>
          <option value="">{t("Choose")}</option>
          <option value="female">{t("Female")}</option>
          <option value="male">{t("Male")}</option>
        </SelectField>
        <TextField
          label={t("NIC")}
          hint={t("9 digits and V or X, or 12 digits. Leave empty if they have none yet.")}
          autoComplete="off"
          spellCheck={false}
          placeholder="200512345678"
          {...form.register("nic")} {...meta("nic")}
        />
        <SelectField label={t("Religion")} {...form.register("religion")} {...meta("religion")}>
          <option value="">{t("Not given")}</option>
          {RELIGIONS.map((option) => (
            <option key={option} value={option}>
              {t(option)}
            </option>
          ))}
          {religion && !(RELIGIONS as readonly string[]).includes(religion) ? (
            <option value={religion}>{religion}</option>
          ) : null}
        </SelectField>
      </Section>

      <Section title={t("Contact")}>
        <TextField label={t("Phone")} type="tel" inputMode="tel" autoComplete="off" placeholder="0771234567" {...form.register("phone")} {...meta("phone")} />
        <TextField label={t("Email")} type="email" autoComplete="off" spellCheck={false} placeholder="name@example.com" {...form.register("email")} {...meta("email")} />
        <div className="sm:col-span-2">
          <TextAreaField label={t("Address")} {...form.register("address")} {...meta("address")} />
        </div>
        <TextField label={t("Emergency contact name")} autoComplete="off" {...form.register("emergencyContactName")} {...meta("emergencyContactName")} />
        <TextField
          label={t("Emergency contact phone")}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="0771234567"
          {...form.register("emergencyContactPhone")} {...meta("emergencyContactPhone")}
        />
      </Section>

      <Section title={t("Learning")}>
        <SelectField label={t("Learning mode")} {...form.register("learningMode")} {...meta("learningMode")}>
          <option value="">{t("Not given")}</option>
          {LEARNING_MODES.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("Medium")} {...form.register("medium")} {...meta("medium")}>
          <option value="">{t("Not given")}</option>
          {MEDIUMS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </SelectField>
        <TextField label={t("School")} autoComplete="off" {...form.register("school")} {...meta("school")} />
        <TextField label={t("Highest qualification")} autoComplete="off" placeholder="G.C.E. O/L" {...form.register("qualification")} {...meta("qualification")} />
        <TextField label={t("Occupation")} hint={t("For adult students.")} autoComplete="off" {...form.register("occupation")} {...meta("occupation")} />
        <div className="hidden sm:block" />
        <TextAreaField label={t("O/L results")} placeholder="Maths A, Science B, English A" {...form.register("olResults")} {...meta("olResults")} />
        <TextAreaField label={t("A/L results")} placeholder="Physics B, Chemistry C, Combined Maths B" {...form.register("alResults")} {...meta("alResults")} />
        {courses && courses.length > 0 ? (
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-ink">{t("Courses")}</legend>
            {studentId ? (
              <p className="mt-1 text-sm text-slate">
                {t("Untick a course to end it today. Tick a new one to start it today. Past courses stay in the student's history.")}
              </p>
            ) : null}
            <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
              {courses.map((course) => (
                <label key={course.id} className="flex min-h-11 items-center gap-3 text-ink">
                  <input
                    type="checkbox"
                    className="size-5 accent-forest"
                    checked={courseIds.includes(course.id)}
                    onChange={(event) =>
                      setCourseIds((current) =>
                        event.target.checked ? [...current, course.id] : current.filter((id) => id !== course.id),
                      )
                    }
                  />
                  {course.name}
                </label>
              ))}
            </div>
            {ending.length > 0 ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {ending.map((course) => (
                  <SelectField
                    key={course.id}
                    id={`ending-${course.id}`}
                    label={`${t("Why is")} ${course.name} ${t("ending?")}`}
                    value={outcomes[course.id] ?? ""}
                    onChange={(event) =>
                      setOutcomes((current) => ({ ...current, [course.id]: event.target.value }))
                    }
                  >
                    <option value="">{t("Not given")}</option>
                    {COURSE_OUTCOMES.map((outcome) => (
                      <option key={outcome.value} value={outcome.value}>
                        {t(outcome.label)}
                      </option>
                    ))}
                  </SelectField>
                ))}
              </div>
            ) : null}
          </fieldset>
        ) : null}
      </Section>

      <Section title={t("Family")}>
        <TextField label={t("Guardian's full name")} autoComplete="off" {...form.register("guardianName")} {...meta("guardianName")} />
        <TextField
          label={t("Guardian's phone")}
          hint={t("Fee reminders and absence messages go to this number on WhatsApp.")}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="0771234567"
          {...form.register("guardianPhone")} {...meta("guardianPhone")}
        />
        <TextField label={t("Guardian's occupation")} autoComplete="off" {...form.register("guardianOccupation")} {...meta("guardianOccupation")} />
        <div className="hidden sm:block" />
        <TextField label={t("Father's full name")} autoComplete="off" {...form.register("fatherName")} {...meta("fatherName")} />
        <TextField label={t("Father's occupation")} autoComplete="off" {...form.register("fatherOccupation")} {...meta("fatherOccupation")} />
        <TextField label={t("Mother's full name")} autoComplete="off" {...form.register("motherName")} {...meta("motherName")} />
        <TextField label={t("Mother's occupation")} autoComplete="off" {...form.register("motherOccupation")} {...meta("motherOccupation")} />
      </Section>

      <Section title={t("Support")}>
        <label className="flex min-h-11 items-center gap-3 text-ink sm:col-span-2">
          <input type="checkbox" className="size-5 accent-forest" {...form.register("hasSpecialNeeds")} />
          {t("Has special needs")}
        </label>
        {hasSpecialNeeds ? (
          <div className="sm:col-span-2">
            <TextAreaField
              label={t("What helps them")}
              hint={t("Only the class owner and their teachers can see this.")}
              {...form.register("specialNeeds")} {...meta("specialNeeds")}
            />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <TextAreaField label={t("Notes")} {...form.register("notes")} {...meta("notes")} />
        </div>
      </Section>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="h-11 px-5" disabled={pending}>
          {pending ? t("Saving…") : studentId ? t("Save changes") : t("Add student")}
        </Button>
        <Link
          href={cancelHref}
          className="press inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-forest"
        >
          {t("Cancel")}
        </Link>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-4 font-heading text-lg font-semibold text-forest">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
