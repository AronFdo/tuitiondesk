"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DueDayField } from "@/components/form/due-day-field";
import { TextAreaField, TextField } from "@/components/form/text-field";
import {
  updateInstitute,
  updateDueDays,
  uploadLogo,
} from "@/lib/actions/institute";
import { t } from "@/lib/t";
import type {
  DueDaysInput,
  InstituteInput,
} from "@/lib/validation/institute";

export function InstituteForm({
  institute,
}: {
  institute: {
    name: string;
    phone: string | null;
    address: string | null;
    timezone: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<InstituteInput>({
    defaultValues: {
      name: institute.name,
      phone: institute.phone ?? "",
      address: institute.address ?? "",
      timezone: institute.timezone,
    },
  });

  async function onSubmit(values: InstituteInput) {
    setError(null);
    setNotice(null);
    setPending(true);
    const result = await updateInstitute(values);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(t("Class details saved"));
    router.refresh();
  }

  return (
    <form className="flex max-w-md flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <h2 className="text-lg">{t("Class details")}</h2>
      <TextField label={t("Class name")} {...form.register("name")} />
      <TextField
        label={t("Phone")}
        inputMode="tel"
        autoComplete="tel"
        placeholder="0771234567"
        {...form.register("phone")}
      />
      <TextAreaField label={t("Address")} {...form.register("address")} />
      <TextField label={t("Timezone")} {...form.register("timezone")} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-slate">{notice}</p> : null}
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? t("Saving…") : t("Save details")}
      </Button>
    </form>
  );
}

export function DueDaysForm({
  days,
}: {
  days: { tuitionDueDay: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<DueDaysInput>({
    defaultValues: {
      tuitionDueDay: days.tuitionDueDay,
    },
  });

  async function onSubmit(values: DueDaysInput) {
    setError(null);
    setNotice(null);
    setPending(true);
    const result = await updateDueDays(values);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(t("Due dates saved"));
    router.refresh();
  }

  return (
    <form className="flex max-w-md flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <h2 className="text-lg">{t("Tuition due day")}</h2>
        <p className="mt-1 text-sm text-slate">
          {t("Reminders will use these dates later.")}
        </p>
      </div>
      <Controller
        control={form.control}
        name="tuitionDueDay"
        render={({ field }) => (
          <DueDayField
            label={t("Tuition fee due day")}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-slate">{notice}</p> : null}
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? t("Saving…") : t("Save dates")}
      </Button>
    </form>
  );
}

export function LogoForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // currentTarget is cleared once the handler awaits, so hold on to the form.
    const form = event.currentTarget;
    setError(null);
    setNotice(null);
    setPending(true);
    const result = await uploadLogo(new FormData(form));
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(t("Logo saved"));
    form.reset();
    router.refresh();
  }

  return (
    <form className="flex max-w-md flex-col gap-4" onSubmit={onSubmit}>
      <h2 className="text-lg">{t("Logo")}</h2>
      <div className="flex flex-col gap-2">
        <label htmlFor="logo" className="text-sm font-medium text-ink">
          {t("Image")}
        </label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="text-sm text-ink file:mr-3 file:h-11 file:rounded-md file:border-0 file:bg-forest file:px-4 file:text-white"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-slate">{notice}</p> : null}
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? t("Saving…") : t("Upload logo")}
      </Button>
    </form>
  );
}
