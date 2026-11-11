import { isAadhaar, maskAadhaar } from "./validators";

// Any ONE of these proves identity.
export const ID_TYPES = {
  aadhaar:  { label: "Aadhaar Card",     hint: "12 digits",             back: true,  clean: (v) => v.replace(/\D/g, "").slice(0, 12), ok: isAadhaar },
  voter:    { label: "Voter ID (EPIC)",  hint: "e.g. ABC1234567",       back: true,  clean: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12), ok: (v) => /^[A-Z]{3}\d{7}$/.test(v) || /^[A-Z0-9]{8,12}$/.test(v) },
  pan:      { label: "PAN Card",         hint: "e.g. ABCDE1234F",       back: false, clean: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10), ok: (v) => /^[A-Z]{5}\d{4}[A-Z]$/.test(v) },
  passport: { label: "Passport",         hint: "e.g. A1234567",         back: true,  clean: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8), ok: (v) => /^[A-Z]\d{7}$/.test(v) },
  license:  { label: "Driving Licence",  hint: "e.g. WB0620110012345",  back: true,  clean: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16), ok: (v) => /^[A-Z]{2}\d{2}[0-9A-Z]{9,12}$/.test(v) },
};
// Aadhaar numbers are sensitive: only the last 4 digits are stored as text.
export const storeNumber = (type, v) => (type === "aadhaar" ? maskAadhaar(v) : v);
