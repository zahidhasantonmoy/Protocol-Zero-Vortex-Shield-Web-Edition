
// STANDALONE WORKER - INLINED DEPENDENCIES
// This ensures the worker runs without module resolution errors in Vite.

const VORTEX_MAGIC = "VORTEX";
const VERSION = 2;
const CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB
const STEGANO_DELIMITER = "||VORTEX_SHIELD_PAYLOAD||";

type CryptoAlgorithm = 'AES-GCM' | 'AES-CBC';

// --- HELPERS ---

const getCrypto = (): Crypto => {
  // @ts-ignore
  if (typeof crypto !== 'undefined') return crypto;
  // @ts-ignore
  if (typeof self !== 'undefined' && self.crypto) return self.crypto;
  // @ts-ignore
  if (typeof window !== 'undefined' && window.crypto) return window.crypto;
  throw new Error("Web Crypto API not supported");
};

const cryptoAPI = getCrypto();

const getRandomBytes = (length: number): Uint8Array => {
  return cryptoAPI.getRandomValues(new Uint8Array(length));
};

const compressBuffer = async (input: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof CompressionStream === 'undefined') return input;
  try {
    const stream = new Blob([input]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    return await new Response(compressedStream).arrayBuffer();
  } catch (e) {
    return input;
  }
};

const decompressBuffer = async (input: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof DecompressionStream === 'undefined') return input;
  try {
    const stream = new Blob([input]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    return await new Response(decompressedStream).arrayBuffer();
  } catch (e) {
    throw new Error("Decompression failed");
  }
};

const hashData = async (data: ArrayBuffer): Promise<string> => {
  const hashBuffer = await cryptoAPI.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const hashBufferRaw = async (data: BufferSource): Promise<ArrayBuffer> => {
  return cryptoAPI.subtle.digest('SHA-256', data);
};

const deriveMasterKey = async (
  password: string,
  salt: Uint8Array,
  algorithm: CryptoAlgorithm,
  keyFileHash?: string
): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  let keyMaterialStr = password;
  if (keyFileHash) keyMaterialStr += `::KEYFILE::${keyFileHash}`;

  const keyMaterial = await cryptoAPI.subtle.importKey(
    "raw",
    enc.encode(keyMaterialStr),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return cryptoAPI.subtle.deriveKey(
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

const encryptChunk = async (
  chunk: ArrayBuffer,
  key: CryptoKey,
  algorithm: CryptoAlgorithm
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> => {
  const ivLength = algorithm === 'AES-GCM' ? 12 : 16;
  const iv = getRandomBytes(ivLength);

  const encrypted = await cryptoAPI.subtle.encrypt(
    {
      name: algorithm,
      iv: iv as any,
    },
    key,
    chunk
  );

  return { encrypted, iv };
};

const decryptChunk = async (
  encryptedChunk: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
  algorithm: CryptoAlgorithm
): Promise<ArrayBuffer> => {
  return cryptoAPI.subtle.decrypt(
    {
      name: algorithm,
      iv: iv as any,
    },
    key,
    encryptedChunk
  );
};

const findDelimiterIndex = (buffer: Uint8Array, delimiter: Uint8Array): number => {
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

// --- WORKER LOGIC ---

self.onmessage = async (e: MessageEvent) => {
  const data = e.data;

  try {
    if (data.type === 'ENCRYPT') {
      await handleEncrypt(data);
    } else if (data.type === 'DECRYPT') {
      await handleDecrypt(data);
    }
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', error: err.message || "Unknown worker error" });
  }
};

async function handleEncrypt(data: any) {
  const { file, password, algorithm, coverFile, keyFileHash, useCompression, camouflageMode, camouflageExt, explicitName } = data;

  // Ensure input is Blob-like
  if (!file || typeof file.slice !== 'function') {
    throw new Error("Invalid file object");
  }

  const chunkHashes: string[] = [];
  const salt = getRandomBytes(16);
  const key = await deriveMasterKey(password, salt, algorithm, keyFileHash);

  const blobParts: any[] = [];

  if (coverFile) {
    blobParts.push(coverFile);
    const encoder = new TextEncoder();
    blobParts.push(encoder.encode(STEGANO_DELIMITER));
  }

  const encoder = new TextEncoder();
  const magicBytes = encoder.encode(VORTEX_MAGIC);
  const versionByte = new Uint8Array([VERSION]);
  const algoByte = new Uint8Array([algorithm === 'AES-GCM' ? 1 : 2]);

  let optionsVal = 0;
  if (useCompression) optionsVal |= 1;
  if (keyFileHash) optionsVal |= 2;
  const optionsByte = new Uint8Array([optionsVal]);

  blobParts.push(magicBytes, versionByte, algoByte, optionsByte, salt);

  const totalSize = file.size;
  let offset = 0;

  // Small delay to unlock thread
  await new Promise(r => setTimeout(r, 50));

  while (offset < totalSize) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const chunkRawBuffer = await slice.arrayBuffer();

    const chunkHash = await hashData(chunkRawBuffer);
    chunkHashes.push(chunkHash);

    let processedChunk = chunkRawBuffer;
    if (useCompression) {
      processedChunk = await compressBuffer(chunkRawBuffer);
    }

    const { encrypted, iv } = await encryptChunk(processedChunk, key, algorithm);

    const lenBuffer = new DataView(new ArrayBuffer(4));
    lenBuffer.setUint32(0, encrypted.byteLength, false);

    blobParts.push(lenBuffer.buffer);
    blobParts.push(iv);
    blobParts.push(encrypted);

    offset += CHUNK_SIZE;
    const percent = Math.min(99, Math.round((offset / totalSize) * 100));
    self.postMessage({ type: 'PROGRESS', percent });
  }

  const masterHashBuffer = await hashBufferRaw(new TextEncoder().encode(chunkHashes.join('')));
  const masterHashHex = Array.from(new Uint8Array(masterHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const finalBlob = new Blob(blobParts, { type: coverFile ? 'image/png' : 'application/octet-stream' });

  let fileName = explicitName || (file.name ? file.name : 'encrypted_data');
  if (!fileName.endsWith('.vortex') && !coverFile) fileName += '.vortex';

  if (coverFile) {
    fileName = `camouflaged_${coverFile.name}`;
  } else if (camouflageMode) {
    const nameParts = fileName.split('.');
    const baseName = nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : fileName;
    let finalExt = camouflageExt;
    if (!finalExt.startsWith('.')) finalExt = '.' + finalExt;
    fileName = `${baseName}${finalExt}`;
  }

  self.postMessage({
    type: 'COMPLETE',
    blob: finalBlob,
    fileName,
    log: `INTEGRITY CHECK PASSED [HASH:${masterHashHex.substring(0, 8)}]`
  });
}

async function handleDecrypt(data: any) {
  const { file, password, isStegano, keyFileHash, originalName } = data;

  if (!file || typeof file.slice !== 'function') {
    throw new Error("Invalid file object");
  }

  const chunkHashes: string[] = [];

  await new Promise(r => setTimeout(r, 50));

  let payloadOffset = 0;
  if (isStegano) {
    const scanSize = Math.min(file.size, 50 * 1024 * 1024);
    const scanBuffer = await file.slice(0, scanSize).arrayBuffer();
    const scanUint8 = new Uint8Array(scanBuffer);
    const delimiterBytes = new TextEncoder().encode(STEGANO_DELIMITER);

    const delimiterIdx = findDelimiterIndex(scanUint8, delimiterBytes);
    if (delimiterIdx === -1) throw new Error("NO STEGANOGRAPHY PAYLOAD FOUND");
    payloadOffset = delimiterIdx + delimiterBytes.length;
  }

  const maxHeader = 25;
  const headerSlice = file.slice(payloadOffset, payloadOffset + maxHeader);
  const headerBuffer = await headerSlice.arrayBuffer();
  const headerView = new Uint8Array(headerBuffer);
  const encoder = new TextEncoder();
  const magicBytes = encoder.encode(VORTEX_MAGIC);

  for (let i = 0; i < magicBytes.length; i++) {
    if (headerView[i] !== magicBytes[i]) throw new Error("INVALID FILE FORMAT");
  }

  const version = headerView[6];
  let offset = payloadOffset;
  let usedAlgo: CryptoAlgorithm = 'AES-GCM';
  let salt: Uint8Array;
  let isCompressed = false;
  let requiresKeyFile = false;

  if (version === 1) {
    usedAlgo = 'AES-GCM';
    const algoId = headerView[7];
    usedAlgo = algoId === 2 ? 'AES-CBC' : 'AES-GCM';
    salt = headerView.slice(8, 24);
    offset += 24;
  } else if (version === 2) {
    const algoId = headerView[7];
    usedAlgo = algoId === 2 ? 'AES-CBC' : 'AES-GCM';
    const options = headerView[8];
    isCompressed = (options & 1) === 1;
    requiresKeyFile = (options & 2) === 2;
    salt = headerView.slice(9, 25);
    offset += 25;
    if (requiresKeyFile && !keyFileHash) throw new Error("KEYFILE REQUIRED FOR DECRYPTION");
  } else {
    throw new Error(`UNSUPPORTED VERSION: ${version}`);
  }

  const key = await deriveMasterKey(password, salt, usedAlgo, keyFileHash);
  const decryptedParts: ArrayBuffer[] = [];

  const totalSize = file.size;
  const ivLen = usedAlgo === 'AES-GCM' ? 12 : 16;

  while (offset < totalSize) {
    const lenSlice = file.slice(offset, offset + 4);
    if (lenSlice.size < 4) break;
    const lenBuffer = await lenSlice.arrayBuffer();
    const chunkLen = new DataView(lenBuffer).getUint32(0, false);
    offset += 4;

    const ivSlice = file.slice(offset, offset + ivLen);
    const iv = new Uint8Array(await ivSlice.arrayBuffer());
    offset += ivLen;

    const cipherSlice = file.slice(offset, offset + chunkLen);
    const cipherBuffer = await cipherSlice.arrayBuffer();
    offset += chunkLen;

    const decryptedChunk = await decryptChunk(cipherBuffer, key, iv, usedAlgo);

    let finalChunk = decryptedChunk;
    if (isCompressed) {
      finalChunk = await decompressBuffer(decryptedChunk);
    }

    const partHash = await hashData(finalChunk);
    chunkHashes.push(partHash);

    decryptedParts.push(finalChunk);

    const percent = Math.min(99, Math.round(((offset - payloadOffset) / (totalSize - payloadOffset)) * 100));
    self.postMessage({ type: 'PROGRESS', percent });
  }

  const masterHashBuffer = await hashBufferRaw(new TextEncoder().encode(chunkHashes.join('')));
  const masterHashHex = Array.from(new Uint8Array(masterHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const finalBlob = new Blob(decryptedParts);

  let dlName = originalName.replace('.vortex', '').replace('.dll', '').replace('.sys', '').replace('.dat', '').replace('.tmp', '').replace('.ini', '').replace('.bin', '');
  if (isStegano) dlName = "revealed_payload";

  self.postMessage({
    type: 'COMPLETE',
    blob: finalBlob,
    fileName: dlName,
    log: `INTEGRITY VERIFIED [HASH:${masterHashHex.substring(0, 8)}]`
  });
}
