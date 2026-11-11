// ---- Aadhaar: 12 digits, can't start with 0/1, and must pass the Verhoeff checksum ----
const D = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
  [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0],
];
const P = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
  [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];
export function verhoeff(num) {
  let c = 0;
  const digits = String(num).split("").reverse().map(Number);
  digits.forEach((d, i) => { c = D[c][P[i % 8][d]]; });
  return c === 0;
}
export const cleanDigits = (v, n) => String(v || "").replace(/\D/g, "").slice(0, n);
export const isAadhaar = (v) => /^[2-9]\d{11}$/.test(v) && verhoeff(v);
export const maskAadhaar = (v) => `XXXX XXXX ${v.slice(-4)}`;

// ---- Driving licence: state code + RTO + year + serial, e.g. WB0620110012345 ----
export const cleanDL = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
export const isLicense = (v) => /^[A-Z]{2}[0-9]{2}[0-9A-Z]{9,12}$/.test(v);

export const maskTail = (v) => (v ? `${"•".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}` : "");
