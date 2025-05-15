// ./utils/crypto.js

import bcrypt from "bcrypt";
import crypto from "crypto";
const PEPPER  = process.env.PEPPER;


// -----------------------------------------------------------------------//
// Copied of https://stackoverflow.com/a/53573115
const ALGORITHM = {
    BLOCK_CIPHER: "aes-256-gcm",
    // 128 bit auth tag is recommended for GCM
    AUTH_TAG_BYTE_LEN: 16,
    // NIST recommends 96 bits or 12 bytes IV for GCM
    IV_BYTE_LEN: 12,
    KEY_BYTE_LEN: 32,
    // To prevent rainbow table attacks
    SALT_BYTE_LEN: 16
}


const getIV = () => crypto.randomBytes(ALGORITHM.IV_BYTE_LEN);
export function getRandomKey(){
    return crypto.randomBytes(ALGORITHM.KEY_BYTE_LEN);
}

export function getSalt(){
    return crypto.randomBytes(ALGORITHM.SALT_BYTE_LEN);
}

export function getKeyPassword(password, salt) {
    return crypto.scryptSync(password, salt, ALGORITHM.KEY_BYTE_LEN);
}

export function encrypt(messagetext, key){
    const iv = getIV();
    const cipher = crypto.createCipheriv(
        ALGORITHM.BLOCK_CIPHER, key, iv,
        { 'authTagLength': ALGORITHM.AUTH_TAG_BYTE_LEN }
    );
    let encryptedMessage = cipher.update(messagetext);
    encryptedMessage = Buffer.concat([encryptedMessage, cipher.final()]);
    return Buffer.concat([iv, encryptedMessage, cipher.getAuthTag()]);
}

export function decrypt(ciphertext, key) {
    const authTag = ciphertext.slice(-16);
    const iv = ciphertext.slice(0, 12);
    const encryptedMessage = ciphertext.slice(12, -16);
    const decipher = crypto.createDecipheriv(
        ALGORITHM.BLOCK_CIPHER, key, iv,
        {'authTagLength': ALGORITHM.AUTH_TAG_BYTE_LEN}
    );
    decipher.setAuthTag(authTag);
    let messagetext = decipher.update(encryptedMessage);
    messagetext = Buffer.concat([messagetext, decipher.final()]);
    return messagetext;
}
// ------------------------------------------------------------------------------------------ //

// Hash Password + Salt + Pepper
export async function hashPassword(password) {
    return bcrypt.hash(password + PEPPER, 10);
    
}

// Compare Password input + pepper with hashed password
export async function verifyPassword(input, hash) {
    return bcrypt.compare(input + PEPPER, hash);
}

// Encrypt user information (returns base64 strings for storage)
export function encryptInfo(firstname, lastname, email, phone, key) {
    return {
        firstname: encrypt(Buffer.from(firstname, "utf8"), key).toString("base64"),
        lastname: encrypt(Buffer.from(lastname, "utf8"), key).toString("base64"),
        email: encrypt(Buffer.from(email, "utf8"), key).toString("base64"),
        phone: phone ? encrypt(Buffer.from(phone, "utf8"), key).toString("base64") : null
    };
}

// Decrypt user information (expects base64 strings)
export function decryptInfo(encryptedData, key) {
    return {
        firstname: decrypt(Buffer.from(encryptedData.firstname, "base64"), key).toString("utf8"),
        lastname: decrypt(Buffer.from(encryptedData.lastname, "base64"), key).toString("utf8"),
        email: decrypt(Buffer.from(encryptedData.email, "base64"), key).toString("utf8"),
        phone: encryptedData.phone ? decrypt(Buffer.from(encryptedData.phone, "base64"), key).toString("utf8") : null
    };
}
