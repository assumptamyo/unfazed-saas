import crypto from "crypto";

// One-time email codes. Codes are stored as an HMAC keyed with the server secret,
// so a copy of the database alone isn't enough to read or guess them offline.
export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 30;
export const MAX_SENDS = 5;

export const generateCode = () => String(crypto.randomInt(100000, 1000000));

export const hashCode = (code) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET).update(String(code)).digest("hex");

export const codeMatches = (code, hash) => {
  const a = Buffer.from(hashCode(code));
  const b = Buffer.from(String(hash || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Checks a submitted code against a record with { codeHash, attempts, expiresAt }.
// Increments attempts on a wrong code. Returns null when OK, or an error message.
export const checkCode = async (record, code) => {
  if (!record || record.expiresAt <= new Date()) {
    return "This code has expired. Please request a new one.";
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return "Too many incorrect attempts. Please request a new code.";
  }
  if (!codeMatches(code, record.codeHash)) {
    record.attempts += 1;
    await record.save();
    const left = MAX_ATTEMPTS - record.attempts;
    return left > 0 ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many incorrect attempts. Please request a new code.";
  }
  return null;
};

// Can another code be sent for this record yet? Returns null or an error message.
export const resendBlocked = (record) => {
  if (record.sends >= MAX_SENDS) return "Too many codes sent. Please start again in a little while.";
  const wait = RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - record.lastSentAt.getTime()) / 1000);
  return wait > 0 ? `Please wait ${wait} seconds before requesting another code.` : null;
};
