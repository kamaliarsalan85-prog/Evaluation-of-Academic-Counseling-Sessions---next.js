import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expectedHex = parts[5];

  if (!salt || !expectedHex || !Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      expectedBuf.length,
      { N, r, p, maxmem: 64 * 1024 * 1024 },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });

  if (derivedKey.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedKey, expectedBuf);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
