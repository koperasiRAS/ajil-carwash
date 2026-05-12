import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

// ── Secret key (no fallback — fail fast if env var is missing) ─────────────────
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
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
  const secret = getJwtSecret()
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

// ── Verify & decode a JWT session ────────────────────────────────────────────
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getJwtSecret()
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