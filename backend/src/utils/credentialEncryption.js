import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import env from "../config/env.js";

const getKey = () => {
  const raw = env.ALERT_CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error("Alert integration encryption is not configured");
  const key = /^[a-f0-9]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32)
    throw new Error(
      "ALERT_CREDENTIAL_ENCRYPTION_KEY must encode exactly 32 bytes",
    );
  return key;
};

export const encryptCredential = (plainText) => {
  if (typeof plainText !== "string" || !plainText)
    throw new Error("Credential cannot be empty");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
};

export const decryptCredential = (encoded) => {
  const [version, ivText, tagText, dataText] = String(encoded || "").split(":");
  if (version !== "v1" || !ivText || !tagText || !dataText)
    throw new Error("Stored integration credential is invalid");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};
