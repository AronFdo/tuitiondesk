"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { TextAreaField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { createStaffMember, updateStaffMember } from "@/lib/actions/staff";
import { t } from "@/lib/t";
import { emptyStaff, staffSchema, type StaffInput } from "@/lib/validation/staff";

// Add or edit a staff member. Course checkboxes show when editing someone
// who can sign in, since a course's teacher is a login.
export function StaffForm({
  staffId,
  defaults,
  courses,
  initialCourseIds = [],
  cancelHref,
}: {
  staffId?: string;
  defaults?: StaffInput;
  courses?: { id: string; name: string }[];
  initialCourseIds?: string[];
  cancelHref: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [courseIds, setCourseIds] = useState<string[]>(initialCourseIds);
  const saving = useRef(false);
  const form = useForm<StaffInput>({ defaultValues: defaults ?? emptyStaff });
  const {
    formState: { errors },
  } = form;
  const meta = (name: Path<StaffInput>) => {
    const message = errors[name as keyof StaffInput]?.message;
    return { id: `staff-${name}`, error: typeof message === "string" ? t(message) : undefined };
  };

  async function submit(values: StaffInput) {
    if (saving.current) {
      return;
    }
    form.clearErrors();
    const parsed = staffSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        form.setError(issue.path[0] as Path<StaffInput>, { message: issue.message });
      }
      form.setFocus(parsed.error.issues[0].path[0] as Path<StaffInput>);
      setError(t("Some details need fixing. They are marked below."));
      return;
    }
    saving.current = true;
    setError(null);
    setPending(true);
    const result = staffId
      ? await updateStaffMember({ staffId, staff: values, courseIds: courses ? courseIds : undefined }).catch(() => null)
      : await createStaffMember({ staff: values }).catch(() => null);
    saving.current = false;
    setPending(false);
    if (!result?.ok) {
      setError(result?.error ?? t("No connection. Nothing was saved. Try again when you are back online."));
      return;
    }
    const target = staffId ?? (result.data as { staffId: string }).staffId;
    router.push(`/staff/${target}`);
    router.refresh();
  }

  return (
    <form className="flex max-w-2xl flex-col gap-10" noValidate onSubmit={(event) => void form.handleSubmit(submit)(event)}>
      <Section title={t("Staff member")}>
        <TextField label={t("Full name")} autoComplete="off" required {...form.register("fullName")} {...meta("fullName")} />
        {/* Paired fields carry no hint text, so their boxes line up across
            the two columns; examples go in the placeholder instead. */}
        <TextField
          label={t("Job title")}
          autoComplete="off"
          placeholder={t("Teacher, Front desk, Accountant…")}
          {...form.register("title")}
          {...meta("title")}
        />
        <TextField
          label={t("NIC")}
          autoComplete="off"
          spellCheck={false}
          placeholder="200512345678"
          {...form.register("nic")}
          {...meta("nic")}
        />
        <TextField label={t("Joined on")} type="date" {...form.register("joinedOn")} {...meta("joinedOn")} />
        <div className="sm:col-span-2">
          <TextField
            label={t("Subjects")}
            hint={t("What they teach or look after.")}
            autoComplete="off"
            {...form.register("subjects")}
            {...meta("subjects")}
          />
        </div>
        <div className="sm:col-span-2">
          <TextAreaField label={t("Notes")} {...form.register("notes")} {...meta("notes")} />
        </div>
      </Section>

      <Section title={t("Contact")}>
        <TextField
          label={t("Phone")}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="0771234567"
          {...form.register("phone")}
          {...meta("phone")}
        />
        <TextField label={t("Email")} type="email" autoComplete="off" {...form.register("email")} {...meta("email")} />
        <div className="sm:col-span-2">
          <TextAreaField label={t("Address")} {...form.register("address")} {...meta("address")} />
        </div>
      </Section>

      {courses ? (
        <fieldset>
          <legend className="mb-2 font-heading text-lg font-semibold text-forest">{t("Courses they teach")}</legend>
          {courses.length === 0 ? (
            <p className="text-slate">{t("No courses yet.")}</p>
          ) : (
            <>
              <p className="text-sm text-slate">
                {t("A course has one teacher. Ticking a course another teacher has moves it to this person.")}
              </p>
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
            </>
          )}
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="h-11 px-5" disabled={pending}>
          {pending ? t("Saving…") : staffId ? t("Save changes") : t("Add staff member")}
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
