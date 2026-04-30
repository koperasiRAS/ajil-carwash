import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

// ── Secret key ────────────────────────────────────────────────────────────────
function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? 'fallback-secret-change-me'
  return new TextEncoder().encode(secret)
}

// ── Payload shape ─────────────────────────────────────────────────────────────
export interface SessionPayload extends JWTPayload {
  userId: string
  name: string
  email: string
}

// ── Sign a new JWT session ────────────────────────────────────────────────────
export async function signSession(payload: {
  userId: string
  name: string
  email: string
}): Promise<string> {
  const secret = getSecretKey()
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

// ── Verify & decode a JWT session ────────────────────────────────────────────
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSecretKey()
    const { payload } = await jwtVerify(token, secret)
    return payload as SessionPayload
  } catch {
    return null
  }
}

// ── Cookie options ────────────────────────────────────────────────────────────
export const SESSION_COOKIE_NAME = 'cw_session'
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
}