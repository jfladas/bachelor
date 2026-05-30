const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

/**
 * Manages encrypted journal storage
 */
class StorageService {
    constructor(appDataPath) {
        this.journalDir = path.join(appDataPath, 'journal-entries');
        this.metadataFile = path.join(appDataPath, 'entries-metadata.json');
        this.saltFile = path.join(appDataPath, 'journal.salt');
        fs.ensureDirSync(this.journalDir);
    }

    /**
     * Check if journal is password protected (salt exists)
     */
    isPINProtected() {
        return fs.existsSync(this.saltFile);
    }

    /**
     * Get or create salt for password derivation
     */
    getSalt() {
        if (fs.existsSync(this.saltFile)) {
            return fs.readFileSync(this.saltFile, 'utf8');
        }

        const salt = crypto.randomBytes(16).toString('hex');
        fs.writeFileSync(this.saltFile, salt, 'utf8');
        return salt;
    }

    /**
     * Save an encrypted journal entry
     * @param {object} entry - Entry metadata
     * @param {object} encryptedData - Encrypted content
     */
    saveEntry(entry, encryptedData) {
        const filename = `${entry.id}.enc`;
        const filepath = path.join(this.journalDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(encryptedData, null, 2), 'utf8');

        // Update metadata index
        this.updateMetadata(entry);
    }

    /**
     * Save a plain (non-encrypted) journal entry
     * @param {object} entry - Entry metadata
     * @param {object} plainData - Plain JSON content
     */
    savePlainEntry(entry, plainData) {
        const filename = `${entry.id}.json`;
        const filepath = path.join(this.journalDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(plainData, null, 2), 'utf8');

        // Update metadata index
        this.updateMetadata(entry);
    }

    /**
     * Load a single encrypted entry
     * @param {string} entryId - Entry ID
     * @param {Function} decryptFn - Function to decrypt data
     */
    loadEntry(entryId, decryptFn) {
        const encPath = path.join(this.journalDir, `${entryId}.enc`);
        const plainPath = path.join(this.journalDir, `${entryId}.json`);

        if (fs.existsSync(plainPath)) {
            return JSON.parse(fs.readFileSync(plainPath, 'utf8'));
        }

        if (fs.existsSync(encPath)) {
            if (typeof decryptFn !== 'function') {
                throw new Error('No decrypt function provided for encrypted entry');
            }

            const encrypted = JSON.parse(fs.readFileSync(encPath, 'utf8'));
            return decryptFn(encrypted);
        }

        throw new Error(`Entry not found: ${entryId}`);
    }

    /**
     * Load all encrypted entries
     * @param {Function} decryptFn - Optional. Function to decrypt encrypted data. If omitted, encrypted entries are skipped.
     */
    loadAllEntries(decryptFn) {
        const files = fs.readdirSync(this.journalDir);

        const results = [];

        for (const f of files) {
            try {
                const full = path.join(this.journalDir, f);

                if (f.endsWith('.enc')) {
                    if (typeof decryptFn !== 'function') {
                        // Skip encrypted entries when no decrypt function is available
                        continue;
                    }

                    const encrypted = JSON.parse(fs.readFileSync(full, 'utf8'));
                    const decrypted = decryptFn(encrypted);
                    results.push(decrypted);
                } else if (f.endsWith('.json')) {
                    const plain = JSON.parse(fs.readFileSync(full, 'utf8'));
                    results.push(plain);
                }
            } catch (error) {
                console.error(`Failed to load/parse entry ${f}:`, error.message);
            }
        }

        return results;
    }

    /**
     * Delete an entry
     */
    deleteEntry(entryId) {
        const encPath = path.join(this.journalDir, `${entryId}.enc`);
        const plainPath = path.join(this.journalDir, `${entryId}.json`);

        if (fs.existsSync(encPath)) {
            fs.removeSync(encPath);
        }

        if (fs.existsSync(plainPath)) {
            fs.removeSync(plainPath);
        }

        this.updateMetadataRemove(entryId);
    }

    /**
     * Update metadata index for a single entry
     */
    updateMetadata(entry) {
        let metadata = [];

        if (fs.existsSync(this.metadataFile)) {
            try {
                metadata = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
            } catch {
                metadata = [];
            }
        }

        const idx = metadata.findIndex((m) => m.id === entry.id);
        if (idx >= 0) {
            metadata[idx] = {
                ...metadata[idx],
                ...entry.metadata,
                updatedAt: new Date().toISOString(),
            };
        } else {
            metadata.push({
                id: entry.id,
                createdAt: new Date().toISOString(),
                ...entry.metadata,
            });
        }

        fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
    }

    /**
     * Remove all journal files and metadata.
     */
    resetJournal() {
        if (fs.existsSync(this.journalDir)) {
            fs.removeSync(this.journalDir);
        }

        if (fs.existsSync(this.metadataFile)) {
            fs.removeSync(this.metadataFile);
        }

        if (fs.existsSync(this.saltFile)) {
            fs.removeSync(this.saltFile);
        }

        fs.ensureDirSync(this.journalDir);
    }

    /**
     * Repair metadata for old entries: mark .enc files as secret if not already marked
     */
    repairMetadata() {
        const files = fs.readdirSync(this.journalDir);
        const metadata = this.getMetadata();
        let modified = false;

        for (const file of files) {
            if (!file.endsWith('.enc')) {
                continue;
            }

            const entryId = file.replace('.enc', '');
            const metaIdx = metadata.findIndex((m) => m.id === entryId);

            if (metaIdx >= 0 && !metadata[metaIdx].isSecret) {
                metadata[metaIdx].isSecret = true;
                modified = true;
            }
        }

        if (modified) {
            fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
        }

        return metadata;
    }

    /**
     * Remove entry from metadata
     */
    updateMetadataRemove(entryId) {
        let metadata = [];

        if (fs.existsSync(this.metadataFile)) {
            try {
                metadata = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
            } catch {
                return;
            }
        }

        metadata = metadata.filter((m) => m.id !== entryId);
        fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
    }

    /**
     * Get metadata for all entries (without decrypting)
     */
    getMetadata() {
        if (!fs.existsSync(this.metadataFile)) {
            return [];
        }

        try {
            return JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
        } catch {
            return [];
        }
    }
}

module.exports = StorageService;
