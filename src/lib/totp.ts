import crypto from 'crypto';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let result = '';
  let bits = 0;
  let current = 0;
  for (const byte of buf) {
    current = (current << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(current >> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) result += BASE32_CHARS[(current << (5 - bits)) & 0x1f];
  return result;
}

function base32Decode(s: string): Buffer {
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of s.toUpperCase().replace(/=+$/, '')) {
    const idx = BASE32_CHARS.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function getOtpAuthUrl(secret: string, email: string, issuer = 'Capsule'): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function computeTOTP(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buf);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  ) % 1_000_000;
  return code.toString().padStart(6, '0');
}

export function verifyTOTP(secret: string, token: string): boolean {
  const key = base32Decode(secret);
  const step = Math.floor(Date.now() / 1000 / 30);
  for (const w of [-1, 0, 1]) {
    if (computeTOTP(key, step + w) === token) return true;
  }
  return false;
}
