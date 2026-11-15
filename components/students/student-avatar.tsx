// A student's photo, or their initials when there is none.
export function StudentAvatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl: string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const box = size === "lg" ? "size-28 text-2xl" : size === "md" ? "size-12 text-base" : "size-10 text-sm";
  if (photoUrl) {
    return (
      // Signed storage links expire; a plain img keeps them out of the image cache.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        className={`${box} shrink-0 rounded-full bg-mint-soft object-cover outline outline-1 -outline-offset-1 outline-black/10`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-full bg-mint-soft font-medium text-forest`}
    >
      {initials(name)}
    </span>
  );
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
