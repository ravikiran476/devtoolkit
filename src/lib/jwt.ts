import { decodeBase64 } from './base64';

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

/** Decodes (does NOT verify) a compact-serialized JWS token. */
export function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) {
    throw new Error(`A JWT has 3 dot-separated segments; found ${parts.length}`);
  }
  return {
    header: parseSegment(parts[0], 'Header'),
    payload: parseSegment(parts[1], 'Payload'),
    signature: parts[2],
  };
}

function parseSegment(segment: string, name: string): Record<string, unknown> {
  let text: string;
  try {
    text = decodeBase64(segment);
  } catch {
    throw new Error(`${name} is not valid Base64URL`);
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

export const CLAIM_INFO: Record<string, string> = {
  iss: 'Issuer',
  sub: 'Subject',
  aud: 'Audience',
  exp: 'Expiration time',
  nbf: 'Not before',
  iat: 'Issued at',
  jti: 'JWT ID',
  azp: 'Authorized party',
  auth_time: 'Authentication time',
  nonce: 'Nonce',
  scope: 'Scopes',
  scp: 'Scopes',
  roles: 'Roles',
  sid: 'Session ID',
  name: 'Full name',
  email: 'Email',
  email_verified: 'Email verified',
  alg: 'Signing algorithm',
  typ: 'Token type',
  kid: 'Key ID',
  cty: 'Content type',
};

export const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat', 'auth_time']);

export type TokenState = 'valid' | 'expired' | 'not-yet-valid' | 'no-expiry';

export function tokenState(payload: Record<string, unknown>, nowMs: number): TokenState {
  const now = nowMs / 1000;
  const { exp, nbf } = payload;
  if (typeof nbf === 'number' && now < nbf) return 'not-yet-valid';
  if (typeof exp === 'number') return now >= exp ? 'expired' : 'valid';
  return 'no-expiry';
}
