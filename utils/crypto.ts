// Web Crypto API Helpers

// Shared Constants
export const VORTEX_MAGIC = "VORTEX";
export const VERSION = 2;
export const CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB
export const STEGANO_DELIMITER = "||VORTEX_SHIELD_PAYLOAD||";

export type CryptoAlgorithm = 'AES-GCM' | 'AES-CBC';

// Compression Helpers (GZIP)
export const compressBuffer = async (input: ArrayBuffer): Promise<ArrayBuffer> => {
  const stream = new Blob([input]).stream();
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
  return new Response(compressedStream).arrayBuffer();
};

export const decompressBuffer = async (input: ArrayBuffer): Promise<ArrayBuffer> => {
  const stream = new Blob([input]).stream();
  const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
  return new Response(decompressedStream).arrayBuffer();
};

// Hashing Helper (SHA-256)
// Using global 'crypto' to work in both Window and Worker scopes
export const hashData = async (data: ArrayBuffer): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const hashBufferRaw = async (data: BufferSource): Promise<ArrayBuffer> => {
  return crypto.subtle.digest('SHA-256', data);
};

// Key Derivation
export const deriveMasterKey = async (
  password: string,
  salt: Uint8Array,
  algorithm: CryptoAlgorithm,
  keyFileHash?: string
): Promise<CryptoKey> => {
  const enc = new TextEncoder();

  let keyMaterialStr = password;
  if (keyFileHash) {
    keyMaterialStr += `::KEYFILE::${keyFileHash}`;
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyMaterialStr),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
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
export const encryptChunk = async (
  chunk: ArrayBuffer,
  key: CryptoKey,
  algorithm: CryptoAlgorithm
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> => {
  const ivLength = algorithm === 'AES-GCM' ? 12 : 16;
  const iv = crypto.getRandomValues(new Uint8Array(ivLength));

  const encrypted = await crypto.subtle.encrypt(
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
  return crypto.subtle.decrypt(
    {
      name: algorithm,
      iv: iv as any,
    },
    key,
    encryptedChunk
  );
};

// Helper: Find a delimiter in a byte array
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