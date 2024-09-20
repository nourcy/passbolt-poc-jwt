const openpgp = require('openpgp');

/**
 * Utility functions for OpenPGP encryption and decryption.
 * @namespace openPGPService
 */
exports.openPGPService = {
    /**
     * Encrypts a given message using an encryption key and signs it with the private key.
     * @function encrypt
     * @memberof openPGPService
     * @param {string} message - The message to be encrypted.
     * @param {string} passphrase - The passphrase for the private key.
     * @returns {Promise<string>} The encrypted message.
     */
    encrypt: async (message, passphrase) => {
        try {
            const messageEncrypted = await openpgp.createMessage({ text: message, format: 'utf8' });

            const readEncryptionKey = await openpgp.readKey({ armoredKey: process.env.PUBLIC_KEY });
            const readSigningKey = await openpgp.readPrivateKey({ armoredKey: process.env.PRIVATE_KEY });

            const decryptedKey = await openpgp.decryptKey({
                privateKey: readSigningKey,
                passphrase
            });

            const encrypted = await openpgp.encrypt({
                message: messageEncrypted,
                encryptionKeys: readEncryptionKey,
                signingKeys: decryptedKey,
            });

            return encrypted;
        } catch (error) {
            console.error("Encryption error:", error);
            throw new Error('Encryption error');
        }
    },

    /**
     * Decrypts a given message using the private key.
     * @function decrypt
     * @memberof openPGPService
     * @param {string} message - The encrypted message.
     * @param {string} passphrase - The passphrase for the private key.
     * @returns {Promise<string>} The decrypted message.
     */
    decrypt: async (message, passphrase) => {
        try {
            // Step 1: Read the encrypted message
            const readMessage = await openpgp.readMessage({ armoredMessage: message });

            // Step 2: Read the private key
            const privateKey = await openpgp.readPrivateKey({ armoredKey: process.env.PRIVATE_KEY });

            // Step 3: Decrypt the private key
            const decryptedKey = await openpgp.decryptKey({
                privateKey: privateKey,
                passphrase: passphrase
            });

            // Step 4: Read the public key for verification
            const verificationKeys = [
                await openpgp.readKey({ armoredKey: process.env.PUBLIC_KEY })
            ];

            // Step 5: Decrypt the message
            const { data: decryptedMessage, signatures } = await openpgp.decrypt({
                message: readMessage,
                decryptionKeys: decryptedKey,
                verificationKeys: verificationKeys
            });

            return decryptedMessage;
        } catch (error) {
            console.error('Decryption error at step:', error);
            throw new Error('Decryption error');
        }
    }
};
