// Browser only: decodes with createImageBitmap and draws on a canvas.

const OUTPUT_SIZE = 512;

// Crop to a square (a little above centre, where faces usually are) and shrink
// to 512 px, so a 4 MB phone photo uploads as about 50 KB.
export async function squarePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) * 0.3;
  const out = Math.min(OUTPUT_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("no canvas");
  }
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no blob"))), "image/jpeg", 0.85);
  });
}
