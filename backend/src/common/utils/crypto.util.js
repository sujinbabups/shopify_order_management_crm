const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM

class CryptoUtil {
  static getKey() {
    const rawKey = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    // Ensure key is 32 bytes (256 bits)
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypt plaintext string using AES-256-GCM
   * Returns format: ivHex:authTagHex:encryptedHex
   */
  static encrypt(plaintext) {
    if (!plaintext) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = CryptoUtil.getKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt AES-256-GCM encrypted string
   */
  static decrypt(ciphertext) {
    if (!ciphertext) return null;
    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        // Fallback if plaintext stored or legacy
        return ciphertext;
      }

      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const key = CryptoUtil.getKey();

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error.message);
      return null;
    }
  }
}

module.exports = CryptoUtil;
