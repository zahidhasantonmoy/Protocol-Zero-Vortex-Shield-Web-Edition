// Web Crypto API Helpers

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

export const generateKey = async (keyMaterial: CryptoKey, salt: Uint8Array): Promise<CryptoKey> => {
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export const encryptData = async (data: ArrayBuffer, password: string): Promise<{ encrypted: ArrayBuffer; salt: Uint8Array; iv: Uint8Array }> => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const keyMaterial = await generateKeyMaterial(password);
  const key = await generateKey(keyMaterial, salt);
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data
  );
  
  return { encrypted, salt, iv };
};

export const decryptData = async (encryptedData: ArrayBuffer, salt: Uint8Array, iv: Uint8Array, password: string): Promise<ArrayBuffer> => {
  const keyMaterial = await generateKeyMaterial(password);
  const key = await generateKey(keyMaterial, salt);
  
  return window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encryptedData
  );
};

export const STEGANO_DELIMITER = "||VORTEX_SHIELD_PAYLOAD||";

export const embedInImage = async (coverImage: ArrayBuffer, encryptedPayload: ArrayBuffer, salt: Uint8Array, iv: Uint8Array): Promise<Blob> => {
  const encoder = new TextEncoder();
  const delimiterBytes = encoder.encode(STEGANO_DELIMITER);
  
  // Format: [Cover Image] [Delimiter] [Salt (16)] [IV (12)] [Encrypted Data]
  const combinedBuffer = new Uint8Array(
    coverImage.byteLength + delimiterBytes.byteLength + salt.byteLength + iv.byteLength + encryptedPayload.byteLength
  );
  
  combinedBuffer.set(new Uint8Array(coverImage), 0);
  let offset = coverImage.byteLength;
  
  combinedBuffer.set(delimiterBytes, offset);
  offset += delimiterBytes.byteLength;
  
  combinedBuffer.set(salt, offset);
  offset += salt.byteLength;
  
  combinedBuffer.set(iv, offset);
  offset += iv.byteLength;
  
  combinedBuffer.set(new Uint8Array(encryptedPayload), offset);
  
  return new Blob([combinedBuffer], { type: 'image/png' });
};

export const extractFromImage = async (imageBuffer: ArrayBuffer): Promise<{ encryptedData: ArrayBuffer; salt: Uint8Array; iv: Uint8Array } | null> => {
  const encoder = new TextEncoder();
  const delimiterBytes = encoder.encode(STEGANO_DELIMITER);
  const uint8Image = new Uint8Array(imageBuffer);
  
  // Naive search for delimiter (sufficient for client-side demo)
  // In production, use KMP algorithm or similar for performance on large files
  let delimiterIndex = -1;
  
  // Search from the end to be faster if appended
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
  
  const salt = uint8Image.slice(offset, offset + 16);
  offset += 16;
  
  const iv = uint8Image.slice(offset, offset + 12);
  offset += 12;
  
  const encryptedData = uint8Image.slice(offset).buffer;
  
  return { encryptedData, salt, iv };
};
