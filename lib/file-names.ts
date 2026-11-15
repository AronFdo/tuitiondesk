// A storage-safe version of an uploaded file's name.
export function safeFileName(name: string) {
  const cleaned = name.replace(/[^\w.\- ()]+/g, "").trim().slice(0, 120);
  return cleaned || "file";
}
