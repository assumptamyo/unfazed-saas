// Suggests a fix for common email domain typos, e.g. "aarav@gmial.com" -> "aarav@gmail.com"
const DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "rediffmail.com",
  "protonmail.com",
  "proton.me",
  "aol.com",
];

const distance = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
};

export const suggestEmail = (email) => {
  const match = /^([^\s@]+)@([^\s@]+\.[^\s@]+)$/.exec((email || "").trim().toLowerCase());
  if (!match) return null;
  const [, user, domain] = match;
  if (DOMAINS.includes(domain)) return null;
  let best = null;
  for (const d of DOMAINS) {
    const dist = distance(domain, d);
    if (dist > 0 && dist <= 2 && (!best || dist < best.dist)) best = { d, dist };
  }
  return best ? `${user}@${best.d}` : null;
};
