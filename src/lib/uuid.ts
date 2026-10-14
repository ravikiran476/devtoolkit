function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

function toUuidString(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** RFC 9562 version 4 (random). */
export function uuidV4(): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return toUuidString(b);
}

/** RFC 9562 version 7 (Unix-epoch milliseconds + random; sortable by creation time). */
export function uuidV7(nowMs = Date.now()): string {
  const b = randomBytes(16);
  for (let i = 0; i < 6; i++) b[i] = Math.floor(nowMs / 2 ** (8 * (5 - i))) % 256;
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  return toUuidString(b);
}

export interface UuidFormat {
  uppercase: boolean;
  hyphens: boolean;
  braces: boolean;
}

export function formatUuid(uuid: string, f: UuidFormat): string {
  let s = f.hyphens ? uuid : uuid.replace(/-/g, '');
  if (f.uppercase) s = s.toUpperCase();
  return f.braces ? `{${s}}` : s;
}

export type UuidInfo =
  | { valid: false }
  | { valid: true; canonical: string; version: number; variant: string; timestampMs?: number; special?: 'nil' | 'max' };

export function inspectUuid(input: string): UuidInfo {
  const stripped = input.trim().replace(/^urn:uuid:/i, '').replace(/^\{(.*)\}$/, '$1');
  if (!/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(stripped)) return { valid: false };

  const hex = stripped.replace(/-/g, '').toLowerCase();
  const canonical = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  if (/^0+$/.test(hex)) return { valid: true, canonical, version: 0, variant: '—', special: 'nil' };
  if (/^f+$/.test(hex)) return { valid: true, canonical, version: 15, variant: '—', special: 'max' };

  const version = parseInt(hex[12], 16);
  const v = parseInt(hex[16], 16);
  const variant = v < 8 ? 'NCS (reserved)' : v < 12 ? 'RFC 9562' : v < 14 ? 'Microsoft (reserved)' : 'Future (reserved)';
  const timestampMs = version === 7 ? parseInt(hex.slice(0, 12), 16) : undefined;
  return { valid: true, canonical, version, variant, timestampMs };
}
