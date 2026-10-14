/** UTF-8 safe Base64 encoding. `urlSafe` produces unpadded Base64URL (RFC 4648 §5). */
export function encodeBase64(text: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const out = btoa(binary);
  return urlSafe ? out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : out;
}

/** Decodes standard or URL-safe Base64 (padding optional, whitespace ignored) into UTF-8 text. */
export function decodeBase64(input: string): string {
  let s = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('Input contains characters outside the Base64 alphabet');
  s = s.replace(/=+$/, '');
  if (s.length % 4 === 1) throw new Error('Invalid Base64 length');
  s += '='.repeat((4 - (s.length % 4)) % 4);

  const binary = atob(s);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Decoded bytes are not valid UTF-8 text');
  }
}
