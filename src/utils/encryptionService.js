import crypto from 'crypto';

/**
 * Encryption service for secure journal storage
 * Uses AES-256-GCM for authenticated encryption
 */
export class EncryptionService {
    /**
     * Derive an encryption key from a master password using PBKDF2
     * @param {string} password - The user's master password
     * @param {string|Buffer} salt - Random salt (hex string or Buffer)
     * @param {number} iterations - PBKDF2 iterations (default: 100000)
     * @returns {Buffer} 32-byte encryption key
     */
    static deriveKey(password, salt, iterations = 100000) {
        const saltBuffer = typeof salt === 'string' ? Buffer.from(salt, 'hex') : salt;
        return crypto.pbkdf2Sync(password, saltBuffer, iterations, 32, 'sha256');
    }

    /**
     * Generate a random salt
     * @param {number} length - Salt length in bytes (default: 16)
     * @returns {Buffer} Random salt
     */
    static generateSalt(length = 16) {
        return crypto.randomBytes(length);
    }

    /**
     * Encrypt plaintext data using AES-256-GCM
     * @param {object} plaintext - Object to encrypt
     * @param {Buffer} key - 32-byte encryption key
     * @returns {object} Encrypted data with nonce, ciphertext, and authTag
     */
    static encrypt(plaintext, key) {
        const nonce = crypto.randomBytes(12); // 96-bit nonce for GCM
        const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);

        let ciphertext = cipher.update(JSON.stringify(plaintext), 'utf8', 'hex');
        ciphertext += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            nonce: nonce.toString('hex'),
            ciphertext,
            authTag: authTag.toString('hex'),
        };
    }

    /**
     * Decrypt encrypted data using AES-256-GCM
     * @param {object} encrypted - Encrypted data object with nonce, ciphertext, authTag
     * @param {Buffer} key - 32-byte encryption key
     * @returns {object} Decrypted plaintext object
     * @throws {Error} If authentication fails (tampered data)
     */
    static decrypt(encrypted, key) {
        const nonce = Buffer.from(encrypted.nonce, 'hex');
        const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');
        const authTag = Buffer.from(encrypted.authTag, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
        decipher.setAuthTag(authTag);

        let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
        plaintext += decipher.final('utf8');

        return JSON.parse(plaintext);
    }
}
