export function buildWhatsAppLink(e164: string, message: string) {
  const digits = e164.replace(/^\+/, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
