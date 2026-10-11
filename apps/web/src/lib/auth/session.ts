import { hkdfSync } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { z } from "zod";

export const SESSION_COOKIE = "devdash_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const sessionSchema = z.object({
  kind: z.enum(["github", "mock", "demo"]),
  login: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  /** GitHub OAuth token (no scopes, public data only). Only present for kind "github". */
  accessToken: z.string().optional(),
});

export type Session = z.infer<typeof sessionSchema>;

/** Derives a 256-bit key so SESSION_SECRET can be any sufficiently long string. */
function encryptionKey(secret: string): Uint8Array {
  return new Uint8Array(hkdfSync("sha256", secret, "devdash-session-v1", "session-encryption", 32));
}

/**
 * Sessions are encrypted (JWE, dir + A256GCM), not just signed, because they
 * carry the viewer's GitHub access token.
 */
export async function sealSession(
  session: Session,
  secret: string,
  now = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  return new EncryptJWT(sessionSchema.parse(session))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_MAX_AGE_SECONDS)
    .encrypt(encryptionKey(secret));
}

export async function unsealSession(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<Session | null> {
  try {
    const { payload } = await jwtDecrypt(token, encryptionKey(secret), {
      currentDate: new Date(now),
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    const parsed = sessionSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
