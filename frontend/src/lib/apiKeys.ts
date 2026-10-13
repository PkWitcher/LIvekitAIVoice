// API key generation/hashing for the public trigger-call API. Raw keys are never stored —
// only a sha256 hash, so a leaked database dump can't be used to impersonate a customer.
import { randomBytes, createHash } from "crypto";

export interface GeneratedApiKey {
  key: string;
  prefix: string;
  hash: string;
}

export function generateApiKey(): GeneratedApiKey {
  const key = `nova_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
