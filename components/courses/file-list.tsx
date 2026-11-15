"use client";

import { useState } from "react";
import { openCourseFile } from "@/lib/actions/content";
import { t } from "@/lib/t";

export function FileList({
  files,
  empty,
  canDelete,
  onDelete,
}: {
  files: { id: string; name: string; sizeBytes: number }[];
  empty: string;
  canDelete?: boolean;
  onDelete?: (file: { id: string; name: string; sizeBytes: number }) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function openFile(fileId: string) {
    setError(null);
    const result = await openCourseFile({ fileId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  if (files.length === 0) {
    return <p className="mt-2 text-slate">{empty}</p>;
  }

  return (
    <div>
      <ul className="mt-2">
        {files.map((file) => (
          <li key={file.id} className="flex items-center border-b border-line">
            <button
              type="button"
              className="row min-w-0 flex-1 justify-between gap-3 text-left"
              onClick={() => void openFile(file.id)}
            >
              <span className="min-w-0 truncate text-ink">{file.name}</span>
              <span className="shrink-0 text-sm text-slate">{formatBytes(file.sizeBytes)}</span>
            </button>
            {canDelete && onDelete ? (
              <button
                type="button"
                className="h-11 px-2 text-sm font-medium text-destructive"
                onClick={() => onDelete(file)}
              >
                {t("Delete")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}
