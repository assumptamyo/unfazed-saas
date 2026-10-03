import crypto from "crypto";
import jwt from "jsonwebtoken";
import Client from "../models/Client.js";

const LINK_DAYS = 90;
const MAX_LINKS = 5;
const CLIENT_SESSION_DAYS = 30;

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

// FRONTEND_URL may list several origins for CORS; links in emails use the first
export const frontendUrl = () =>
  ((process.env.FRONTEND_URL || "").split(",")[0].trim() || "http://localhost:5173").replace(/\/$/, "");

// Create a private link into the client's space. Only the hash is stored, so a
// database leak doesn't expose working links. Older links keep working until they expire.
export const createPortalLink = async (client) => {
  const raw = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const active = (client.portalTokens || []).filter((t) => t.expiresAt > now);
  client.portalTokens = [
    ...active.slice(-(MAX_LINKS - 1)),
    { hash: sha256(raw), createdAt: new Date(now), expiresAt: new Date(now + LINK_DAYS * 864e5) },
  ];
  await client.save();
  return `${frontendUrl()}/portal/${raw}`;
};

export const issueClientToken = (client) =>
  jwt.sign({ clientId: client._id, role: "client" }, process.env.JWT_SECRET, {
    expiresIn: `${CLIENT_SESSION_DAYS}d`,
  });

// Swap a link token for a login token scoped to this one client
export const exchangePortalToken = async (raw) => {
  if (!/^[a-f0-9]{64}$/.test(raw || "")) return null;
  const client = await Client.findOne({
    portalTokens: { $elemMatch: { hash: sha256(raw), expiresAt: { $gt: new Date() } } },
  });
  if (!client) return null;

  return { token: issueClientToken(client), client };
};
