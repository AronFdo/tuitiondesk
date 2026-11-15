import { Button } from "@/components/ui/button";

export function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return <p className="text-sm text-destructive">{message}</p>;
}

export function SubmitButton({
  label,
  pending,
}: {
  label: string;
  pending: boolean;
}) {
  return (
    <Button type="submit" className="h-11 w-full" disabled={pending}>
      {label}
    </Button>
  );
}
