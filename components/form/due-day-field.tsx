"use client";

import { useState } from "react";
import { TextField } from "@/components/form/text-field";
import { colomboToday, formatDueDay } from "@/lib/dates";
import { nextDateForDay } from "@/lib/dues";
import { t } from "@/lib/t";

// Picks a date, saves its day of the month. The fee then repeats on that day.
export function DueDayField({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (day: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  const [date, setDate] = useState(() =>
    value ? nextDateForDay(Number(value), colomboToday()) : "",
  );
  const day = Number(value);

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label={label}
        name={name}
        type="date"
        value={date}
        error={error}
        aria-describedby={`${name}-hint`}
        onBlur={onBlur}
        onChange={(event) => {
          const next = event.target.value;
          setDate(next);
          onChange(next ? String(Number(next.slice(8, 10))) : "");
        }}
      />
      <p id={`${name}-hint`} className="text-sm text-slate">
        {day
          ? `${t("Repeats on the")} ${formatDueDay(day)} ${t("of each month")}${
              day > 28 ? `, ${t("or the last day in shorter months")}` : ""
            }.`
          : t("Pick the next due date. It repeats each month on that day.")}
      </p>
    </div>
  );
}
