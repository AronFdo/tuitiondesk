import { t } from "@/lib/t";

// Copies of a student's papers (ID, birth certificate, certificates). Plain
// data, safe to use in the browser.

// Every kind the database accepts; older exam paperwork uses some of these.
export const DOCUMENT_KINDS = [
  "id_copy",
  "passport",
  "postal_id",
  "birth_certificate",
  "photo",
  "payment_proof",
  "statement_of_entry",
  "result_slip",
  "certificate",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// What staff can upload now.
export const UPLOAD_DOCUMENT_KINDS: DocumentKind[] = [
  "id_copy",
  "passport",
  "postal_id",
  "birth_certificate",
  "certificate",
  "other",
];

export function documentLabel(kind: DocumentKind): string {
  const labels: Record<DocumentKind, string> = {
    id_copy: "NIC copy",
    passport: "Passport copy",
    postal_id: "Postal ID copy",
    birth_certificate: "Birth certificate",
    photo: "Photo",
    payment_proof: "Payment proof",
    statement_of_entry: "Statement of entry",
    result_slip: "Result slip",
    certificate: "Certificate",
    other: "Other",
  };
  return t(labels[kind]);
}

export type StudentDocument = {
  id: string;
  kind: DocumentKind;
  fileName: string;
};
