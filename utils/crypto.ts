// Web Crypto API Helpers

export type CryptoAlgorithm = 'AES-GCM' | 'AES-CBC';

export const generateKeyMaterial = async (password: string): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  return window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
};

export const generateKey = async (keyMaterial: CryptoKey, salt: Uint8Array, algorithm: CryptoAlgorithm): Promise<CryptoKey> => {
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

export const encryptData = async (
  data: ArrayBuffer, 
  password: string, 
  algorithm: CryptoAlgorithm = 'AES-GCM'
): Promise<{ encrypted: ArrayBuffer; salt: Uint8Array; iv: Uint8Array }> => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  // IV length: GCM = 12 bytes, CBC = 16 bytes
  const ivLength = algorithm === 'AES-GCM' ? 12 : 16;
  const iv = window.crypto.getRandomValues(new Uint8Array(ivLength));
  
  const keyMaterial = await generateKeyMaterial(password);
  const key = await generateKey(keyMaterial, salt, algorithm);
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: algorithm,
      iv: iv,
    },
    key,
    data
  );
  
  return { encrypted, salt, iv };
};

export const decryptData = async (
  encryptedData: ArrayBuffer, 
  salt: Uint8Array, 
  iv: Uint8Array, 
  password: string,
  algorithm: CryptoAlgorithm = 'AES-GCM'
): Promise<ArrayBuffer> => {
  const keyMaterial = await generateKeyMaterial(password);
  const key = await generateKey(keyMaterial, salt, algorithm);
  
  return window.crypto.subtle.decrypt(
    {
      name: algorithm,
      iv: iv,
    },
    key,
    encryptedData
  );
};

export const STEGANO_DELIMITER = "||VORTEX_SHIELD_PAYLOAD||";

export const embedInImage = async (
  coverImage: ArrayBuffer, 
  encryptedPayload: ArrayBuffer, 
  salt: Uint8Array, 
  iv: Uint8Array,
  algorithm: CryptoAlgorithm = 'AES-GCM'
): Promise<Blob> => {
  const encoder = new TextEncoder();
  const delimiterBytes = encoder.encode(STEGANO_DELIMITER);
  
  // Create a metadata block: [AlgoID (1 byte)]
  // 1 = GCM, 2 = CBC
  const algoId = algorithm === 'AES-GCM' ? 1 : 2;
  const metaBuffer = new Uint8Array([algoId]);

  // Construct Blob from parts to avoid massive contiguous memory allocation
  // Layout: [Cover] [Delimiter] [AlgoID] [Salt] [IV] [EncryptedData]
  return new Blob([
    coverImage,
    delimiterBytes,
    metaBuffer,
    salt,
    iv,
    encryptedPayload
  ], { type: 'image/png' });
};

export const extractFromImage = async (imageBuffer: ArrayBuffer): Promise<{ encryptedData: ArrayBuffer; salt: Uint8Array; iv: Uint8Array, algorithm: CryptoAlgorithm } | null> => {
  const encoder = new TextEncoder();
  const delimiterBytes = encoder.encode(STEGANO_DELIMITER);
  const uint8Image = new Uint8Array(imageBuffer);
  
  // Search for delimiter from the end
  let delimiterIndex = -1;
  for (let i = uint8Image.length - delimiterBytes.length; i >= 0; i--) {
    let match = true;
    for (let j = 0; j < delimiterBytes.length; j++) {
      if (uint8Image[i + j] !== delimiterBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      delimiterIndex = i;
      break;
    }
  }
  
  if (delimiterIndex === -1) return null;
  
  let offset = delimiterIndex + delimiterBytes.length;
  
  // Read Algo ID
  // If we are reading old files without AlgoID, we might need a heuristic, 
  // but here we assume the new format for stability if delimiter is present.
  // Check if enough bytes remain for Algo(1) + Salt(16) + IV(12 min)
  if (offset + 1 + 16 + 12 > uint8Image.length) return null;

  const algoId = uint8Image[offset];
  offset += 1;

  const algorithm: CryptoAlgorithm = algoId === 2 ? 'AES-CBC' : 'AES-GCM';
  const ivLength = algorithm === 'AES-GCM' ? 12 : 16;

  const salt = uint8Image.slice(offset, offset + 16);
  offset += 16;
  
  const iv = uint8Image.slice(offset, offset + ivLength);
  offset += ivLength;
  
  const encryptedData = uint8Image.slice(offset).buffer;
  
  return { encryptedData, salt, iv, algorithm };
};
