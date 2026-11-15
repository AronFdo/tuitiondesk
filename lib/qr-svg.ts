import QRCode from "qrcode";

// An SVG QR code that scales to its box. Server only: the qrcode package is
// kept out of client bundles.
export async function qrSvg(text: string) {
  const svg = await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return svg.replace("<svg ", '<svg width="100%" height="100%" ');
}
