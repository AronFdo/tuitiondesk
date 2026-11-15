"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { SelectField, TextAreaField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { updateReceiptSettings, type ReceiptSettingsInput } from "@/lib/actions/receipts";
import { t } from "@/lib/t";

export function ReceiptSettingsForm({ defaults }: { defaults: ReceiptSettingsInput }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<ReceiptSettingsInput>({ defaultValues: defaults });

  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        setError(null);
        setNotice(null);
        setPending(true);
        const result = await updateReceiptSettings(values).catch(() => null);
        setPending(false);
        if (!result?.ok) {
          setError(result?.error ?? t("No connection. Those settings were not saved. Try again when you are back online."));
          return;
        }
        setNotice(t("Receipt settings saved"));
        router.refresh();
      })}
    >
      <div>
        <h2 className="text-lg">{t("Receipts")}</h2>
        <p className="mt-1 text-sm text-slate">
          {t("Every payment gets a numbered receipt. Print it on a thermal printer from the payment, or later from Payments.")}
        </p>
      </div>
      <SelectField label={t("Paper width")} {...form.register("paperMm")}>
        <option value="80">{t("80 mm (most desk printers)")}</option>
        <option value="58">{t("58 mm (small and portable printers)")}</option>
      </SelectField>
      <TextAreaField
        label={t("Footer")}
        placeholder={t("Thank you. Fees are due by the 10th of each month.")}
        maxLength={200}
        {...form.register("footer")}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p role="status" className="text-sm text-slate">
        {notice}
      </p>
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? t("Saving…") : t("Save receipt settings")}
      </Button>

      <section className="mt-4 border-t border-line pt-4">
        <h3 className="font-medium text-ink">{t("Setting up the printer")}</h3>
        <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm text-slate">
          <li>{t("Install the printer's driver on the desk computer and set its paper to the roll width above.")}</li>
          <li>{t("Make it the default printer, with margins set to none.")}</li>
          <li>
            {t("To print without the print dialog, start Chrome with --kiosk-printing. Receipts then print as soon as you press Print receipt.")}
          </li>
        </ol>
      </section>
    </form>
  );
}
