// Indian mobile numbers only: 10 digits, starting with 6, 7, 8 or 9.
export const INDIA_PHONE = /^[6-9]\d{9}$/;

// Keep only digits; drop a leading +91 / 91 / 0 if someone pastes it.
export function cleanPhone(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

export const isIndianPhone = (v) => INDIA_PHONE.test(v);
export const fmtPhone = (v) => (v ? `+91 ${String(v).replace(/^\+91/, "")}` : "");
