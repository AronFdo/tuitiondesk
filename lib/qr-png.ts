import QRCode from "qrcode";

// A PNG QR code, large enough to print sharply. Server only, like qr-svg.ts.
export async function qrPng(text: string): Promise<Uint8Array> {
  const buffer = await QRCode.toBuffer(text, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 1024,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return new Uint8Array(buffer);
}
