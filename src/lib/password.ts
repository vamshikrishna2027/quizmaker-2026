const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const HASH_PREFIX = "pbkdf2";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer.slice(
        salt.byteOffset,
        salt.byteOffset + salt.byteLength,
      ) as ArrayBuffer,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_BITS,
  );

  return new Uint8Array(bits);
}

/**
 * Hash a password with PBKDF2-SHA256 via the Web Crypto API (Workers-compatible).
 * Format: pbkdf2$<iterations>$<saltB64>$<hashB64>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return [
    HASH_PREFIX,
    String(PBKDF2_ITERATIONS),
    bytesToBase64(salt),
    bytesToBase64(hash),
  ].join("$");
}

/**
 * Compare a plain-text password to a stored hash produced by hashPassword.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== HASH_PREFIX) {
    return false;
  }

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const salt = base64ToBytes(parts[2]);
  const expected = base64ToBytes(parts[3]);
  const actual = await deriveBits(password, salt, iterations);

  if (actual.length !== expected.length) {
    return false;
  }

  // Constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < actual.length; i += 1) {
    mismatch |= actual[i]! ^ expected[i]!;
  }
  return mismatch === 0;
}
