import argon2 from 'argon2';

// Pre-computed dummy Argon2id hash for constant-time mitigation when accounts do not exist
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$z6r+L1w4F3i7u8v9Q0x1y2$Z2ZtQW50aWdyYXZpdHlEdW1teUhhc2hWYWx1ZQ';

/**
 * Hashes a plaintext password using Argon2id.
 * @param {string} plainPassword
 * @returns {Promise<string>} Argon2id password hash string
 */
export async function hashPassword(plainPassword) {
  if (typeof plainPassword !== 'string' || plainPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 * @param {string|null|undefined} passwordHash
 * @param {string} plainPassword
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(passwordHash, plainPassword) {
  if (!passwordHash || typeof passwordHash !== 'string' || typeof plainPassword !== 'string') {
    return false;
  }
  try {
    return await argon2.verify(passwordHash, plainPassword);
  } catch {
    return false;
  }
}

/**
 * Executes a dummy verification to mitigate response timing analysis when user or hash is absent.
 * @param {string} plainPassword
 */
export async function dummyVerify(plainPassword) {
  try {
    await argon2.verify(DUMMY_HASH, String(plainPassword || ''));
  } catch {
    // Ignore dummy verification error
  }
}
