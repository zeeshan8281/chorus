import { randomBytes } from "node:crypto";

/** Readable, collision-resistant id with a type prefix. */
export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("hex")}`;
}

/** Opaque access token for authenticating an agent against the HTTP service. */
export function generateApiKey(): string {
  return `amk_${randomBytes(24).toString("base64url")}`;
}
