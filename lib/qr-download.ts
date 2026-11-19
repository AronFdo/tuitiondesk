// Naming a downloaded QR image after the student, so a folder of them reads
// as a class list. Kept free of server-only imports so it can be tested.

// "Amal Perera.png". Characters that file systems reject are dropped; names
// in Sinhala or Tamil are kept. Falls back to the student code.
export function qrFileName(fullName: string, code: string) {
  const cleaned = fullName
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 100)
    .trim();
  const base = cleaned || code.replace(/[^\w-]+/g, "") || "student";
  return `${base}.png`;
}

// A Content-Disposition header that keeps a non-English name: browsers that
// read filename* get the real name, older ones get the plain-ASCII fallback.
export function attachmentHeader(fileName: string, fallback: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]+/g, "").replace(/["\\]/g, "").replace(/\s+/g, " ").trim();
  const plain = ascii && ascii !== ".png" ? ascii : fallback;
  return `attachment; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
