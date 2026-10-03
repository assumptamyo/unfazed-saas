// Indian mobile numbers: 10 digits starting 6-9, optionally written with +91 / 91 / 0,
// spaces or dashes. Returns the canonical "+91XXXXXXXXXX", or null if it isn't valid.
export const normalizeIndianMobile = (input) => {
  let digits = String(input ?? "").replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
};
