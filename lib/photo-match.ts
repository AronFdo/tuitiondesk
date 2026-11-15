// Pairs the photos chosen alongside an import CSV with the rows they belong
// to. A row's Photo column names its file; a row without one is matched to a
// photo named after the student ("Nimal Perera.jpg", "nimal_perera.JPG").
// Nothing is guessed: two candidates, a missing file or one file claimed by
// two rows is reported, and that row imports without a photo.

export type PhotoRow = { line: number; fullName: string; photo: string };

export type RowPhoto = {
  // The chosen file's name, or null when the row gets no photo.
  fileName: string | null;
  // Why a photo the row asked for, or might have had, is not attached.
  problem: string | null;
};

export type PhotoMatches = {
  byLine: Map<number, RowPhoto>;
  // Chosen photos that belong to no row.
  unused: string[];
};

const UNREADABLE = /\.(heic|heif)$/i;

function fileKey(name: string) {
  return name.trim().normalize("NFC").toLowerCase();
}

// "Nimal_Perera (1).JPG" -> "nimal perera (1)"; spaces, dashes and
// underscores all count as one space.
function baseKey(name: string) {
  return fileKey(name)
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function nameKey(fullName: string) {
  return fullName.normalize("NFC").toLowerCase().replace(/[\s_-]+/g, " ").trim();
}

export function matchPhotos(rows: PhotoRow[], fileNames: string[]): PhotoMatches {
  const byFile = new Map<string, string>();
  const byBase = new Map<string, string[]>();
  for (const name of fileNames) {
    byFile.set(fileKey(name), name);
    const base = baseKey(name);
    byBase.set(base, [...(byBase.get(base) ?? []), name]);
  }

  const byLine = new Map<number, RowPhoto>();
  for (const row of rows) {
    const asked = row.photo.trim();
    if (asked) {
      // Named in the CSV: the exact file, or the same name without its extension.
      const exact = byFile.get(fileKey(asked));
      const loose = /\.[a-z0-9]+$/i.test(asked) ? undefined : byBase.get(baseKey(asked));
      const found = exact ?? (loose?.length === 1 ? loose[0] : undefined);
      byLine.set(
        row.line,
        found
          ? { fileName: found, problem: null }
          : {
              fileName: null,
              problem:
                loose && loose.length > 1
                  ? `More than one photo is named "${asked}". Give the file its full name in the Photo column.`
                  : `"${asked}" is not among the chosen photos.`,
            },
      );
      continue;
    }
    // Not named: a photo named after the student, if there is exactly one.
    const candidates = byBase.get(nameKey(row.fullName)) ?? [];
    byLine.set(
      row.line,
      candidates.length === 1
        ? { fileName: candidates[0], problem: null }
        : candidates.length > 1
          ? { fileName: null, problem: `More than one photo is named after ${row.fullName}. Put the right file name in the Photo column.` }
          : { fileName: null, problem: null },
    );
  }

  // One photo, one student.
  const claimed = new Map<string, number[]>();
  for (const [line, match] of byLine) {
    if (match.fileName) {
      claimed.set(match.fileName, [...(claimed.get(match.fileName) ?? []), line]);
    }
  }
  for (const [fileName, lines] of claimed) {
    if (lines.length > 1) {
      for (const line of lines) {
        byLine.set(line, {
          fileName: null,
          problem: `"${fileName}" is matched to rows ${lines.join(", ")}. Each photo can go to one student.`,
        });
      }
    }
  }
  for (const [line, match] of byLine) {
    if (match.fileName && UNREADABLE.test(match.fileName)) {
      byLine.set(line, {
        fileName: match.fileName,
        problem: "HEIC photos may not open in this browser. If it fails, export it as JPEG and add it from the student's page.",
      });
    }
  }

  const used = new Set([...byLine.values()].flatMap((match) => (match.fileName ? [match.fileName] : [])));
  return { byLine, unused: fileNames.filter((name) => !used.has(name)) };
}
