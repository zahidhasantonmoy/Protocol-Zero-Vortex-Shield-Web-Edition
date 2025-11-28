// Web Crypto API Helpers

export type CryptoAlgorithm = 'AES-GCM' | 'AES-CBC';

export const STEGANO_DELIMITER = "||VORTEX_SHIELD_PAYLOAD||";

// Key Derivation
// We derive a master key once per file using PBKDF2
export const deriveMasterKey = async (password: string, salt: Uint8Array, algorithm: CryptoAlgorithm): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: algorithm, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

// Chunk Encryption
// Encrypts a single slice of the file. Returns the encrypted data and the specific IV used for this chunk.
export const encryptChunk = async (
  chunk: ArrayBuffer, 
  key: CryptoKey, 
  algorithm: CryptoAlgorithm
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> => {
  const ivLength = algorithm === 'AES-GCM' ? 12 : 16;
  const iv = window.crypto.getRandomValues(new Uint8Array(ivLength));
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: algorithm,
      iv: iv,
    },
    key,
    chunk
  );
  
  return { encrypted, iv };
};

// Chunk Decryption
export const decryptChunk = async (
  encryptedChunk: ArrayBuffer, 
  key: CryptoKey, 
  iv: Uint8Array, 
  algorithm: CryptoAlgorithm
): Promise<ArrayBuffer> => {
  return window.crypto.subtle.decrypt(
    {
      name: algorithm,
      iv: iv,
    },
    key,
    encryptedChunk
  );
};

// Helper: Find a delimiter in a byte array
// Used to locate where the cover image ends and the payload begins without loading the whole file
export const findDelimiterIndex = (buffer: Uint8Array, delimiter: Uint8Array): number => {
    for (let i = 0; i <= buffer.length - delimiter.length; i++) {
        let found = true;
        for (let j = 0; j < delimiter.length; j++) {
            if (buffer[i + j] !== delimiter[j]) {
                found = false;
                break;
            }
        }
        if (found) return i;
    }
    return -1;
};