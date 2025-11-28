import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Unlock, Eye, Trash2, AlertTriangle, Terminal, FileCode, Loader2, FileText, FileLock, Github, Linkedin, Facebook, Globe, Code, Settings, RotateCcw, X, Clock, Copy, Check, Key, FileArchive, Fingerprint, Info } from 'lucide-react';
import MatrixText from './components/MatrixText';
import CyberButton from './components/CyberButton';
import DropZone from './components/DropZone';
import { deriveMasterKey, encryptChunk, decryptChunk, findDelimiterIndex, STEGANO_DELIMITER, CryptoAlgorithm, compressBuffer, decompressBuffer, hashData, hashBufferRaw } from './utils/crypto';
import { playSound } from './utils/audio';

enum AppMode {
  ENCRYPT = 'ENCRYPT',
  DECRYPT = 'DECRYPT',
  STEGANO = 'STEGANO',
  INCINERATOR = 'INCINERATOR'
}

const STORAGE_KEY = 'vortex_shield_state';
const CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB chunk size for streaming
const INACTIVITY_LIMIT_MS = 5 * 60 * 1000; // 5 Minutes

const App: React.FC = () => {
  // --- State ---
  const [mode, setMode] = useState<AppMode>(AppMode.ENCRYPT);
  const [files, setFiles] = useState<File[]>([]);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>(['> SYSTEM INITIALIZED', '> VORTEX SHIELD v3.1 ONLINE']);
  const [duressMode, setDuressMode] = useState(false);
  const [showFakeSuccess, setShowFakeSuccess] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  // Advanced Settings
  const [camouflageMode, setCamouflageMode] = useState(false);
  const [camouflageExt, setCamouflageExt] = useState('.dll');
  const [algorithm, setAlgorithm] = useState<CryptoAlgorithm>('AES-GCM');
  const [resumeAvailable, setResumeAvailable] = useState(false);
  
  // New Features
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [keyFileHash, setKeyFileHash] = useState<string>('');
  const [useCompression, setUseCompression] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [lastOutput, setLastOutput] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const processingRef = useRef<boolean>(false);

  const fakeExtensions = ['.dll', '.sys', '.dat', '.tmp', '.ini', '.bin'];

  // --- Effects ---

  useEffect(() => {
    processingRef.current = isProcessing;
  }, [isProcessing]);

  // Load State
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            if (parsed.mode || parsed.algorithm || parsed.password) {
                setResumeAvailable(true);
            }
        } catch (e) {
            console.error("Failed to load state", e);
        }
    }
  }, []);

  // Save State
  const stateRef = useRef({ mode, files, password, algorithm, camouflageMode, camouflageExt, useCompression });
  
  useEffect(() => {
    stateRef.current = { mode, files, password, algorithm, camouflageMode, camouflageExt, useCompression };
  }, [mode, files, password, algorithm, camouflageMode, camouflageExt, useCompression]);

  const saveCurrentState = () => {
      const s = stateRef.current;
      const stateToSave = {
          mode: s.mode,
          algorithm: s.algorithm,
          camouflageMode: s.camouflageMode,
          camouflageExt: s.camouflageExt,
          useCompression: s.useCompression,
          filesDetails: s.files.map(f => ({ name: f.name, size: f.size })),
          password: s.password, 
          timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  };

  useEffect(() => { saveCurrentState(); }, [mode, algorithm, camouflageMode, camouflageExt, files, password, useCompression]);
  useEffect(() => {
      const interval = setInterval(saveCurrentState, 30000);
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Inactivity
  useEffect(() => {
    const handleInactivityTimeout = () => {
        if (processingRef.current) { resetTimer(true); return; }
        
        setPassword('');
        setFiles([]);
        setKeyFile(null);
        setKeyFileHash('');
        setCoverImage(null);
        setLastOutput(null);
        setPasswordStrength(0);
        setShowConfirmModal(false);
        setShowAboutModal(false);
        addLog('WARNING: SESSION TIMEOUT. SECURE DATA CLEARED.');
        playSound('error');
    };

    const resetTimer = (force = false) => {
        const now = Date.now();
        if (!force && now - lastActivityRef.current < 1000) return;
        lastActivityRef.current = now;
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(handleInactivityTimeout, INACTIVITY_LIMIT_MS);
    };

    window.addEventListener('mousemove', () => resetTimer());
    window.addEventListener('keydown', () => resetTimer());
    window.addEventListener('click', () => resetTimer());
    window.addEventListener('dragover', () => resetTimer());

    resetTimer(true);

    return () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        window.removeEventListener('mousemove', () => resetTimer());
        window.removeEventListener('keydown', () => resetTimer());
        window.removeEventListener('click', () => resetTimer());
        window.removeEventListener('dragover', () => resetTimer());
    };
  }, []); 

  // --- Helpers ---
  const calculateStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const copyToClipboard = async () => {
    if (lastOutput) {
        try {
            await navigator.clipboard.writeText(lastOutput);
            setCopySuccess(true);
            playSound('success');
            setTimeout(() => setCopySuccess(false), 2000);
            addLog('OUTPUT INFO COPIED TO CLIPBOARD');
        } catch (err) {
            addLog('ERROR: CLIPBOARD ACCESS DENIED');
            playSound('error');
        }
    }
  };

  const handleKeyFileSelect = async (selectedFiles: File[]) => {
      if (selectedFiles.length > 0) {
          const kf = selectedFiles[0];
          setKeyFile(kf);
          addLog(`KEY FILE LOADED: ${kf.name}`);
          
          // Hash Keyfile
          try {
             // For large keyfiles, reading into RAM is bad, but keyfiles are usually small.
             // We'll support up to 64MB keyfiles for now to match chunk size.
             if (kf.size > CHUNK_SIZE) {
                 addLog('WARNING: KEY FILE TOO LARGE (>64MB). USING FIRST 64MB ONLY.');
             }
             const slice = kf.slice(0, Math.min(kf.size, CHUNK_SIZE));
             const buffer = await slice.arrayBuffer();
             const hash = await hashData(buffer);
             setKeyFileHash(hash);
             addLog(`KEY HASH: ${hash.substring(0, 16)}...`);
             playSound('success');
          } catch (e) {
              addLog('ERROR PROCESSING KEY FILE');
              playSound('error');
          }
      }
  };

  // --- Handlers ---

  const handleResumeSession = () => {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
          try {
              const parsed = JSON.parse(savedState);
              if (parsed.mode) setMode(parsed.mode);
              if (parsed.algorithm) setAlgorithm(parsed.algorithm);
              if (parsed.camouflageMode !== undefined) setCamouflageMode(parsed.camouflageMode);
              if (parsed.camouflageExt) setCamouflageExt(parsed.camouflageExt);
              if (parsed.useCompression !== undefined) setUseCompression(parsed.useCompression);
              if (parsed.password) {
                  setPassword(parsed.password);
                  setPasswordStrength(calculateStrength(parsed.password));
              }
              
              setResumeAvailable(false);
              addLog('> SESSION SETTINGS RESTORED');
              if (parsed.filesDetails && parsed.filesDetails.length > 0) {
                addLog(`> PENDING: RE-SELECT ${parsed.filesDetails.length} FILES`);
              }
              playSound('success');
          } catch (e) {
              addLog('> ERROR: CORRUPT SESSION DATA');
          }
      }
  };

  const addLog = (msg: string) => {
    setLog(prev => [...prev.slice(-10), `> ${msg}`]);
  };

  const handleFilesSelect = (selectedFiles: File[]) => {
      setIsScanning(true);
      setFiles([]);
      setLastOutput(null);
      addLog(`SCANNING ${selectedFiles.length} FILES...`);
      playSound('process');
      setTimeout(() => {
          setFiles(selectedFiles);
          setIsScanning(false);
          addLog(`BATCH LOADED: ${selectedFiles.length} FILES READY`);
          playSound('success');
      }, 800);
  };

  const handleCoverSelect = (files: File[]) => {
      if (files.length === 0) return;
      const selectedFile = files[0];
      setIsScanning(true);
      setCoverImage(null);
      addLog(`ANALYZING COVER IMAGE...`);
      setTimeout(() => {
          setCoverImage(selectedFile);
          setIsScanning(false);
          addLog(`COVER IMAGE ACCEPTED`);
          playSound('success');
      }, 600);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setPasswordStrength(calculateStrength(val));
    if (val === 'panic') {
      triggerDuressMode();
    }
  };

  const triggerDuressMode = () => {
    setDuressMode(true);
    addLog('CRITICAL: DURESS SIGNAL DETECTED');
    addLog('ENGAGING DECOY PROTOCOLS...');
    setTimeout(() => {
        setFiles([]);
        setKeyFile(null);
        setCoverImage(null);
        setMode(AppMode.DECRYPT);
        setPassword('');
        setPasswordStrength(0);
    }, 1000);
  };

  // HEADER CONSTANTS
  const VORTEX_MAGIC = "VORTEX"; 
  const VERSION = 2; // Bumped to 2 for Options support

  // --- CORE CHUNKED ENCRYPTION LOGIC ---
  const executeChunkedEncryption = async (inputFile: File, coverFile: File | null = null) => {
      setProgress(0);
      setLastOutput(null);
      
      const chunkHashes: string[] = [];

      try {
          const salt = window.crypto.getRandomValues(new Uint8Array(16));
          // Derive key using Password AND KeyFileHash
          const key = await deriveMasterKey(password, salt, algorithm, keyFileHash || undefined);
          
          const blobParts: (Blob | ArrayBuffer | Uint8Array)[] = [];
          
          // 1. If Stegano
          if (coverFile) {
              blobParts.push(coverFile);
              const encoder = new TextEncoder();
              blobParts.push(encoder.encode(STEGANO_DELIMITER));
          }

          // 2. Add Global Header
          // Format: [Magic(6)] [Ver(1)=2] [Algo(1)] [Options(1)] [Salt(16)]
          const encoder = new TextEncoder();
          const magicBytes = encoder.encode(VORTEX_MAGIC);
          const versionByte = new Uint8Array([VERSION]);
          const algoByte = new Uint8Array([algorithm === 'AES-GCM' ? 1 : 2]); 
          
          // Options Byte: Bit 0 = Compression, Bit 1 = KeyFile Used
          let optionsVal = 0;
          if (useCompression) optionsVal |= 1;
          if (keyFileHash) optionsVal |= 2;
          const optionsByte = new Uint8Array([optionsVal]);

          blobParts.push(magicBytes, versionByte, algoByte, optionsByte, salt);

          // 3. Process File Chunks
          const totalSize = inputFile.size;
          let offset = 0;

          addLog('STREAMING ENCRYPTION STARTED...');

          while (offset < totalSize) {
              const slice = inputFile.slice(offset, offset + CHUNK_SIZE);
              const chunkRawBuffer = await slice.arrayBuffer();

              // Integrity: Hash the original chunk
              const chunkHash = await hashData(chunkRawBuffer);
              chunkHashes.push(chunkHash);

              // Compression (if enabled)
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
              setProgress(percent);
              
              await new Promise(r => setTimeout(r, 0));
          }

          // Calculate Merkle Root / Master Hash
          const masterHashBuffer = await hashBufferRaw(new TextEncoder().encode(chunkHashes.join('')));
          const masterHashHex = Array.from(new Uint8Array(masterHashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
          
          addLog(`SOURCE INTEGRITY HASH: ${masterHashHex.substring(0, 16)}...`);

          // 4. Finalize
          const finalBlob = new Blob(blobParts, { type: coverFile ? 'image/png' : 'application/octet-stream' });
          
          let fileName = `${inputFile.name}.vortex`;
          if (coverFile) {
              fileName = `camouflaged_${coverFile.name}`;
          } else if (camouflageMode) {
              const nameParts = inputFile.name.split('.');
              const baseName = nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : inputFile.name;
              let finalExt = camouflageExt;
              if (!finalExt.startsWith('.')) finalExt = '.' + finalExt;
              fileName = `${baseName}${finalExt}`;
          }

          downloadBlob(finalBlob, fileName);
          return fileName;

      } catch (e: any) {
          throw new Error(e.message);
      }
  };

  // --- CORE CHUNKED DECRYPTION LOGIC ---
  const executeChunkedDecryption = async (inputBlob: Blob, isStegano: boolean, originalName: string) => {
      setProgress(0);
      setLastOutput(null);
      const chunkHashes: string[] = [];

      try {
          // 1. Locate Payload
          let payloadOffset = 0;
          if (isStegano) {
              const scanSize = Math.min(inputBlob.size, 50 * 1024 * 1024);
              const scanBuffer = await inputBlob.slice(0, scanSize).arrayBuffer();
              const scanUint8 = new Uint8Array(scanBuffer);
              const delimiterBytes = new TextEncoder().encode(STEGANO_DELIMITER);
              
              const delimiterIdx = findDelimiterIndex(scanUint8, delimiterBytes);
              if (delimiterIdx === -1) throw new Error("NO STEGANOGRAPHY PAYLOAD FOUND");
              payloadOffset = delimiterIdx + delimiterBytes.length;
          }

          // 2. Read Global Header
          // V1: 24 bytes, V2: 25 bytes
          // We read enough for V2 first
          const maxHeader = 25;
          const headerSlice = inputBlob.slice(payloadOffset, payloadOffset + maxHeader);
          const headerBuffer = await headerSlice.arrayBuffer();
          const headerView = new Uint8Array(headerBuffer);
          const encoder = new TextEncoder();
          const magicBytes = encoder.encode(VORTEX_MAGIC);

          for(let i=0; i<magicBytes.length; i++) {
              if (headerView[i] !== magicBytes[i]) throw new Error("INVALID FILE FORMAT");
          }

          const version = headerView[6];
          let offset = payloadOffset;
          let usedAlgo: CryptoAlgorithm = 'AES-GCM';
          let salt: Uint8Array;
          let isCompressed = false;
          let requiresKeyFile = false;

          if (version === 1) {
             usedAlgo = 'AES-GCM'; // V1 assumes GCM
             const algoId = headerView[7];
             usedAlgo = algoId === 2 ? 'AES-CBC' : 'AES-GCM';
             salt = headerView.slice(8, 24);
             offset += 24;
             addLog('DETECTED V1 LEGACY CONTAINER');
          } else if (version === 2) {
             const algoId = headerView[7];
             usedAlgo = algoId === 2 ? 'AES-CBC' : 'AES-GCM';
             const options = headerView[8];
             isCompressed = (options & 1) === 1;
             requiresKeyFile = (options & 2) === 2;
             
             salt = headerView.slice(9, 25);
             offset += 25;
             addLog(`DETECTED V2 CONTAINER [COMPRESSION:${isCompressed ? 'ON' : 'OFF'}]`);
             if (requiresKeyFile && !keyFileHash) {
                 throw new Error("THIS FILE REQUIRES A KEYFILE FOR DECRYPTION");
             }
          } else {
              throw new Error(`UNSUPPORTED VERSION: ${version}`);
          }

          // 3. Derive Key
          const key = await deriveMasterKey(password, salt, usedAlgo, keyFileHash || undefined);
          const decryptedParts: ArrayBuffer[] = [];

          // 4. Loop Chunks
          const totalSize = inputBlob.size;
          const ivLen = usedAlgo === 'AES-GCM' ? 12 : 16;

          while (offset < totalSize) {
              const lenSlice = inputBlob.slice(offset, offset + 4);
              if (lenSlice.size < 4) break;
              const lenBuffer = await lenSlice.arrayBuffer();
              const chunkLen = new DataView(lenBuffer).getUint32(0, false);
              offset += 4;

              const ivSlice = inputBlob.slice(offset, offset + ivLen);
              const iv = new Uint8Array(await ivSlice.arrayBuffer());
              offset += ivLen;

              const cipherSlice = inputBlob.slice(offset, offset + chunkLen);
              const cipherBuffer = await cipherSlice.arrayBuffer();
              offset += chunkLen;

              const decryptedChunk = await decryptChunk(cipherBuffer, key, iv, usedAlgo);
              
              let finalChunk = decryptedChunk;
              if (isCompressed) {
                  finalChunk = await decompressBuffer(decryptedChunk);
              }

              // Integrity Hash
              const partHash = await hashData(finalChunk);
              chunkHashes.push(partHash);

              decryptedParts.push(finalChunk);

              const percent = Math.min(99, Math.round(((offset - payloadOffset) / (totalSize - payloadOffset)) * 100));
              setProgress(percent);
              await new Promise(r => setTimeout(r, 0));
          }

          // Verify Integrity
          const masterHashBuffer = await hashBufferRaw(new TextEncoder().encode(chunkHashes.join('')));
          const masterHashHex = Array.from(new Uint8Array(masterHashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
          addLog(`DECRYPTED INTEGRITY HASH: ${masterHashHex.substring(0, 16)}...`);

          // 5. Finalize
          const finalBlob = new Blob(decryptedParts);
          let dlName = originalName.replace('.vortex', '').replace(camouflageExt, '');
          if (isStegano) dlName = "revealed_payload.bin";

          downloadBlob(finalBlob, dlName);
          return dlName;

      } catch (e: any) {
          throw new Error(e.message);
      }
  };


  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEncrypt = async () => {
    if (files.length === 0 || !password) return;
    setIsProcessing(true);
    addLog('STARTING BATCH ENCRYPTION...');

    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        addLog(`[${i+1}/${files.length}] ENCRYPTING: ${f.name}`);
        try {
            const out = await executeChunkedEncryption(f);
            setLastOutput(out);
        } catch (e: any) {
            addLog(`FAILED: ${f.name}`);
            addLog(`[!] ERROR: ${e.message || "Unknown encryption error"}`);
            playSound('error');
        }
    }
    
    setIsProcessing(false);
    setProgress(100);
    addLog('BATCH OPERATION COMPLETE.');
    playSound('success');
  };

  const handleDecrypt = async () => {
      if (files.length === 0 || !password) return;
      if (duressMode) {
          setIsProcessing(true);
          await new Promise(r => setTimeout(r, 2000));
          setIsProcessing(false);
          setShowFakeSuccess(true);
          return;
      }
      
      setIsProcessing(true);
      addLog('STARTING BATCH DECRYPTION...');

      for (let i = 0; i < files.length; i++) {
          const f = files[i];
          addLog(`[${i+1}/${files.length}] DECRYPTING: ${f.name}`);
          try {
              const out = await executeChunkedDecryption(f, false, f.name);
              setLastOutput(out);
          } catch (e: any) {
             addLog(`FAILED: ${f.name}`);
             addLog(`[!] REASON: ${e.message || "Decryption signature mismatch or corruption"}`);
             playSound('error');
          }
      }

      setIsProcessing(false);
      setProgress(100);
      addLog('BATCH OPERATION COMPLETE.');
      playSound('success');
  };

  const handleStegano = async () => {
      if (files.length === 0 || !coverImage || !password) return;
      setIsProcessing(true);
      addLog(`EMBEDDING ${files.length} PAYLOADS...`);
      
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        addLog(`[${i+1}/${files.length}] HIDING: ${f.name}`);
        try {
            await executeChunkedEncryption(f, coverImage);
        } catch (e: any) {
            addLog(`FAILED: ${f.name}`);
            addLog(`[!] ERROR: ${e.message || "Embedding failure"}`);
            playSound('error');
        }
      }
      setIsProcessing(false);
      setProgress(100);
      addLog('BATCH OPERATION COMPLETE.');
      playSound('success');
  };

  const handleSteganoDecrypt = async () => {
      if (files.length === 0 || !password) return;
      setIsProcessing(true);
      
      for (let i = 0; i < files.length; i++) {
          const f = files[i];
          addLog(`[${i+1}/${files.length}] EXTRACTING FROM: ${f.name}`);
          try {
             await executeChunkedDecryption(f, true, f.name);
          } catch (e: any) {
             addLog(`FAILED: ${f.name}`);
             addLog(`[!] ERROR: ${e.message || "No payload found or password incorrect"}`);
             playSound('error');
          }
      }
      setIsProcessing(false);
      setProgress(100);
      addLog('BATCH OPERATION COMPLETE.');
      playSound('success');
  };

  const handleIncinerateClick = () => {
      if (files.length === 0) return;
      setShowConfirmModal(true);
  };

  const handleIncinerateConfirm = async () => {
      setShowConfirmModal(false);
      if(files.length === 0) return;
      setIsProcessing(true);
      
      addLog(`INITIATING BATCH INCINERATION: ${files.length} FILES`);
      
      for (let i = 0; i < files.length; i++) {
          const f = files[i];
          addLog(`[${i+1}/${files.length}] PURGING: ${f.name}`);
          try {
              for(let p=0; p<3; p++) {
                 setProgress(((p+1)/3)*100);
                 await new Promise(r => setTimeout(r, 400));
              }
          } catch(e: any) {
              addLog(`FAILED TO INCINERATE: ${f.name}`);
              playSound('error');
          }
      }

      addLog('MEMORY BUFFERS FLUSHED.');
      setFiles([]);
      setLastOutput("BATCH INCINERATED");
      setIsProcessing(false);
      playSound('success');
  };

  // --- Render ---

  if (duressMode && showFakeSuccess) {
      return (
          <div className="min-h-screen bg-white flex flex-col items-center justify-center text-gray-800 p-8">
              <div className="text-4xl mb-4">📂 My Documents</div>
              <p>Folder is empty.</p>
              <button onClick={() => window.location.reload()} className="mt-8 text-blue-500 underline">Refresh</button>
          </div>
      );
  }

  const renderFileList = () => (
      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 mb-4">
          {files.map((f, idx) => (
               <div key={`${f.name}-${idx}`} className="flex items-center gap-3 bg-[#00E5FF] bg-opacity-5 border border-[#00E5FF] border-opacity-20 p-3 rounded animate-in fade-in slide-in-from-top-2 shadow-[0_0_10px_rgba(0,229,255,0.05)]">
                    <div className="p-2 bg-[#00E5FF] bg-opacity-10 rounded flex-shrink-0">
                        {mode === AppMode.STEGANO ? <FileLock className="w-5 h-5 text-[#00E5FF]" /> : <Shield className="w-5 h-5 text-[#00E5FF]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="text-[#00E5FF] text-sm font-bold truncate tracking-wide">{f.name}</div>
                       <div className="text-gray-500 text-xs font-mono flex items-center gap-2">
                           <span>{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                           <span className="text-[#00E5FF] opacity-30">|</span>
                           <span className="uppercase">{f.type || 'UNKNOWN TYPE'}</span>
                       </div>
                    </div>
                    <button 
                       onClick={(e) => {
                           e.stopPropagation();
                           setFiles(prev => prev.filter((_, i) => i !== idx));
                           playSound('click');
                       }} 
                       className="p-1.5 hover:bg-red-500/20 hover:text-red-500 rounded transition-colors text-gray-500"
                       title="Remove File"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
          ))}
      </div>
  );

  const renderCoverImageDetail = (currentFile: File) => (
    <div className="flex items-center gap-3 bg-[#00E5FF] bg-opacity-5 border border-[#00E5FF] border-opacity-20 p-3 rounded mt-2 mb-4 animate-in fade-in slide-in-from-top-2 shadow-[0_0_10px_rgba(0,229,255,0.05)]">
         <div className="p-2 bg-[#00E5FF] bg-opacity-10 rounded flex-shrink-0">
             <FileCode className="w-5 h-5 text-[#00E5FF]" />
         </div>
         <div className="flex-1 min-w-0">
            <div className="text-[#00E5FF] text-sm font-bold truncate tracking-wide">{currentFile.name}</div>
            <div className="text-gray-500 text-xs font-mono flex items-center gap-2">
                <span>{(currentFile.size / 1024 / 1024).toFixed(2)} MB</span>
                <span className="uppercase">COVER IMAGE</span>
            </div>
         </div>
         <button 
            onClick={(e) => {
                e.stopPropagation();
                setCoverImage(null);
                playSound('click');
            }} 
            className="p-1.5 hover:bg-red-500/20 hover:text-red-500 rounded transition-colors text-gray-500"
            title="Remove File"
         >
             <X className="w-4 h-4" />
         </button>
     </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      {/* Background Matrix Rain Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-5" style={{ 
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px'
      }}></div>

      {/* Main Window */}
      <div className="w-full max-w-2xl bg-[#0a0a0a] border border-[#00E5FF] border-opacity-30 shadow-[0_0_50px_rgba(0,229,255,0.1)] rounded-sm relative overflow-hidden backdrop-blur-md z-20">
        
        {/* Header Bar */}
        <div className="bg-[#00E5FF] bg-opacity-10 p-3 flex justify-between items-center border-b border-[#00E5FF] border-opacity-20 select-none">
            <div className="flex items-center gap-2 text-[#00E5FF]">
                <Shield className="w-5 h-5 animate-pulse" />
                <span className="font-bold tracking-widest text-sm">VORTEX SHIELD <span className="text-[10px] opacity-70">ULTIMATE_EDITION_V3.1</span></span>
            </div>
            
            <div className="flex items-center gap-2">
                {resumeAvailable && (
                    <button 
                        onClick={handleResumeSession}
                        className="flex items-center gap-1 text-[10px] bg-[#00E5FF] bg-opacity-10 text-[#00E5FF] px-2 py-1 rounded border border-[#00E5FF] border-opacity-30 hover:bg-[#00E5FF] hover:bg-opacity-20 transition-colors animate-pulse"
                    >
                        <RotateCcw className="w-3 h-3" />
                        RESUME
                    </button>
                )}
                
                <button 
                    onClick={() => setShowAboutModal(true)}
                    className="p-1.5 text-[#00E5FF] hover:bg-[#00E5FF] hover:bg-opacity-20 rounded transition-colors"
                    title="System Information"
                >
                    <Info className="w-4 h-4" />
                </button>

                <div className="flex gap-2 ml-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                </div>
            </div>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-4 border-b border-[#00E5FF] border-opacity-20 text-xs sm:text-sm">
            {[
                { id: AppMode.ENCRYPT, icon: Lock, label: 'ENCRYPT' },
                { id: AppMode.DECRYPT, icon: Unlock, label: 'DECRYPT' },
                { id: AppMode.STEGANO, icon: Eye, label: 'GHOST MODE' },
                { id: AppMode.INCINERATOR, icon: Trash2, label: 'INCINERATOR' }
            ].map((item) => (
                <button
                    key={item.id}
                    onClick={() => {
                        setMode(item.id);
                        setFiles([]);
                        setCoverImage(null);
                        setLog([]);
                        setPassword('');
                        setPasswordStrength(0);
                        setLastOutput(null);
                        setShowConfirmModal(false);
                        addLog(`SWITCHING MODE TO ${item.id}...`);
                    }}
                    className={`p-3 flex flex-col items-center gap-1 transition-colors ${mode === item.id ? 'bg-[#00E5FF] text-black font-bold' : 'text-gray-400 hover:text-[#00E5FF] hover:bg-[#00E5FF] hover:bg-opacity-5'}`}
                >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                </button>
            ))}
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-6">
            
            {/* Alert Banner for Incinerator */}
            {mode === AppMode.INCINERATOR && (
                <div className="bg-red-900/20 border border-red-500/50 p-4 rounded text-red-400 flex items-start gap-3 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                        <strong className="block mb-1">DOD STANDARD 5220.22-M PROTOCOL</strong>
                        This will perform a 3-pass overwrite of the file buffer in memory before releasing the reference. 
                        Note: Browser sandboxing prevents physical disk sectors from being directly wiped.
                    </div>
                </div>
            )}

            {/* Stegano Image Drop */}
            {mode === AppMode.STEGANO && (
                <>
                    <DropZone 
                        onFilesSelect={handleCoverSelect} 
                        label="DROP COVER IMAGE (.PNG/.JPG)"
                        accept="image/*"
                        multiple={false}
                    />
                    {isScanning && !coverImage && files.length === 0 && (
                        <div className="text-center text-[#00E5FF] text-xs animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                            ANALYZING BITMAP STRUCTURE...
                        </div>
                    )}
                    {coverImage && !isScanning && renderCoverImageDetail(coverImage)}
                </>
            )}

            {/* Main File Drop */}
            <DropZone 
                onFilesSelect={handleFilesSelect} 
                label={mode === AppMode.STEGANO ? "DROP PAYLOAD FILES" : "DROP TARGET FILES"}
            />
            {isScanning && files.length === 0 && (
                 <div className="text-center text-[#00E5FF] text-xs animate-pulse">
                     <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                     VERIFYING INTEGRITY...
                 </div>
            )}
            {files.length > 0 && !isScanning && renderFileList()}

            {/* Global Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {/* Algorithm */}
                 <div className="space-y-3">
                     {(mode === AppMode.ENCRYPT || mode === AppMode.STEGANO) && (
                        <div className="flex items-center justify-between bg-[#00E5FF] bg-opacity-5 border border-[#00E5FF] border-opacity-20 p-2 rounded">
                            <div className="flex items-center gap-2">
                                <Settings className="w-4 h-4 text-[#00E5FF]" />
                                <span className="text-xs text-gray-400 font-bold tracking-wider">ALGORITHM</span>
                            </div>
                            <div className="flex gap-1">
                                {(['AES-GCM', 'AES-CBC'] as CryptoAlgorithm[]).map((algo) => (
                                    <button
                                        key={algo}
                                        onClick={() => setAlgorithm(algo)}
                                        className={`text-[10px] px-2 py-1 rounded border transition-all ${
                                            algorithm === algo 
                                            ? 'bg-[#00E5FF] text-black border-[#00E5FF] font-bold' 
                                            : 'border-gray-700 text-gray-500 hover:border-[#00E5FF]'
                                        }`}
                                    >
                                        {algo}
                                    </button>
                                ))}
                            </div>
                        </div>
                     )}
                 </div>

                 {/* Advanced Encryption Options */}
                 {(mode === AppMode.ENCRYPT || mode === AppMode.STEGANO) && (
                     <div className="space-y-3">
                        {/* Compression Toggle */}
                        <div 
                            onClick={() => setUseCompression(!useCompression)}
                            className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${useCompression ? 'bg-[#00E5FF] bg-opacity-10 border-[#00E5FF]' : 'border-gray-800 hover:border-[#00E5FF]'}`}
                        >
                            <div className="flex items-center gap-2">
                                <FileArchive className={`w-4 h-4 ${useCompression ? 'text-[#00E5FF]' : 'text-gray-500'}`} />
                                <span className={`text-xs font-bold tracking-wider ${useCompression ? 'text-[#00E5FF]' : 'text-gray-500'}`}>COMPRESSION</span>
                            </div>
                            <div className={`w-3 h-3 rounded-full ${useCompression ? 'bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]' : 'bg-gray-800'}`}></div>
                        </div>

                         {/* Key File Drop (Mini) */}
                         <div className={`relative p-2 rounded border border-dashed transition-all ${keyFile ? 'border-[#00E5FF] bg-[#00E5FF] bg-opacity-5' : 'border-gray-700 hover:border-[#00E5FF]'}`}>
                             <DropZone 
                                onFilesSelect={handleKeyFileSelect} 
                                label={keyFile ? "KEY FILE ACTIVE" : "DROP KEY FILE (OPTIONAL)"} 
                                multiple={false}
                             />
                             <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-4">
                                <div className="flex items-center gap-2 z-10 bg-black/50 p-1 rounded backdrop-blur-sm">
                                    <Key className={`w-4 h-4 ${keyFile ? 'text-[#00E5FF]' : 'text-gray-500'}`} />
                                    <span className={`text-xs font-bold ${keyFile ? 'text-[#00E5FF]' : 'text-gray-500'}`}>
                                        {keyFile ? keyFile.name.substring(0, 15) : "KEY FILE AUTH"}
                                    </span>
                                </div>
                                {keyFile && (
                                    <Fingerprint className="w-4 h-4 text-[#00E5FF] animate-pulse z-10" />
                                )}
                             </div>
                         </div>
                     </div>
                 )}
            </div>

            {/* Password Field */}
            {mode !== AppMode.INCINERATOR && (
                <div className="relative group">
                    <label className="text-[10px] uppercase text-gray-500 mb-1 block tracking-wider">Passphrase / Key</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={handlePasswordChange}
                        placeholder="ENTER SECURE KEY..."
                        className="w-full bg-black/50 border border-[#00E5FF] border-opacity-30 p-3 text-[#00E5FF] focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all placeholder-gray-700 font-mono"
                    />
                    <div className="absolute right-3 top-8 text-[#00E5FF] opacity-30">
                        <Lock className="w-4 h-4" />
                    </div>
                    
                    {/* Password Strength Meter */}
                    <div className="mt-2 flex items-center justify-between">
                        <div className="flex gap-1 h-1 flex-1 max-w-[150px]">
                             {[1,2,3,4].map((level) => (
                                 <div 
                                    key={level} 
                                    className={`flex-1 h-full rounded-sm transition-all duration-300 ${
                                        passwordStrength >= level 
                                        ? level === 1 ? 'bg-red-500' : level === 2 ? 'bg-orange-500' : level === 3 ? 'bg-yellow-400' : 'bg-green-500'
                                        : 'bg-gray-800'
                                    }`}
                                 ></div>
                             ))}
                        </div>
                        <div className="text-[10px] font-bold tracking-wider uppercase">
                            {passwordStrength === 0 ? <span className="text-gray-600">ENTER KEY</span> :
                             passwordStrength === 1 ? <span className="text-red-500">WEAK</span> :
                             passwordStrength === 2 ? <span className="text-orange-500">MODERATE</span> :
                             passwordStrength === 3 ? <span className="text-yellow-400">GOOD</span> :
                             <span className="text-green-500">STRONG</span>}
                        </div>
                    </div>
                </div>
            )}

            {/* Camouflage Mode Option (Encrypt Only) */}
            {mode === AppMode.ENCRYPT && (
                 <div className="bg-[#00E5FF] bg-opacity-5 border border-[#00E5FF] border-opacity-20 p-3 rounded transition-all">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#00E5FF] opacity-80">
                            <FileCode className="w-4 h-4" />
                            <span className="font-bold text-xs tracking-wider">CAMOUFLAGE MODE</span>
                        </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={camouflageMode}
                                onChange={(e) => setCamouflageMode(e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-gray-900 peer-focus:outline-none rounded-full peer border border-gray-700 peer-checked:border-[#00E5FF] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00E5FF] peer-checked:bg-opacity-20 peer-checked:after:bg-[#00E5FF]"></div>
                        </label>
                    </div>
                    
                    {camouflageMode && (
                        <div className="mt-3 animate-in fade-in slide-in-from-top-1 space-y-3">
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {fakeExtensions.map(ext => (
                                    <button
                                        key={ext}
                                        onClick={() => setCamouflageExt(ext)}
                                        className={`text-[10px] sm:text-xs py-1 px-1 rounded transition-all font-mono border ${
                                            camouflageExt === ext 
                                            ? 'bg-[#00E5FF] text-black border-[#00E5FF] font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]' 
                                            : 'bg-black border-gray-800 text-gray-500 hover:border-[#00E5FF] hover:text-[#00E5FF]'
                                        }`}
                                    >
                                        {ext}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={camouflageExt}
                                    onChange={(e) => setCamouflageExt(e.target.value)}
                                    className="w-full bg-black/50 border border-[#00E5FF] border-opacity-30 text-[#00E5FF] text-xs p-2 rounded focus:border-[#00E5FF] focus:outline-none focus:shadow-[0_0_10px_rgba(0,229,255,0.2)] font-mono placeholder-gray-700"
                                    placeholder="CUSTOM EXTENSION (E.G. .XYZ)"
                                />
                            </div>
                        </div>
                    )}
                 </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-4">
                {/* Last Output / Copy Bar */}
                {lastOutput && (
                    <div className="bg-[#00E5FF] bg-opacity-10 border border-[#00E5FF] border-opacity-30 p-2 rounded flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Check className="w-4 h-4 text-[#00E5FF] shrink-0" />
                            <span className="text-xs font-mono text-[#00E5FF] truncate">{lastOutput}</span>
                        </div>
                        <button 
                            onClick={copyToClipboard}
                            className={`p-1.5 rounded transition-all shrink-0 ${copySuccess ? 'bg-green-500 text-black' : 'hover:bg-[#00E5FF] hover:bg-opacity-20 text-[#00E5FF]'}`}
                            title="Copy to Clipboard"
                        >
                            {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                )}

                <div className="flex justify-end items-center gap-4 pt-4 border-t border-[#00E5FF] border-opacity-10">
                    {(isProcessing || isScanning) && (
                        <div className="flex items-center gap-2 text-[#00E5FF] animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-xs font-mono">
                                {isScanning ? 'SCANNING_SOURCE...' : 'PROCESSING_DATA_STREAM...'}
                            </span>
                        </div>
                    )}

                    {mode === AppMode.ENCRYPT && (
                        <CyberButton 
                            label={isProcessing ? "ENCRYPTING..." : "ACTIVATE SHIELD"} 
                            onClick={handleEncrypt} 
                            disabled={files.length === 0 || !password || isProcessing || isScanning} 
                            isLoading={isProcessing}
                        />
                    )}
                    {mode === AppMode.DECRYPT && (
                        <CyberButton 
                            label={isProcessing ? "DECRYPTING..." : "UNLOCK VAULT"} 
                            onClick={handleDecrypt}
                            disabled={files.length === 0 || !password || isProcessing || isScanning} 
                            isLoading={isProcessing}
                        />
                    )}
                    {mode === AppMode.STEGANO && (
                         <div className="flex gap-2">
                             <CyberButton 
                                label="EXTRACT" 
                                variant="ghost"
                                onClick={handleSteganoDecrypt}
                                disabled={files.length === 0 || !password || isProcessing || isScanning}
                                isLoading={isProcessing}
                            />
                             <CyberButton 
                                label="EMBED" 
                                onClick={handleStegano}
                                disabled={files.length === 0 || !coverImage || !password || isProcessing || isScanning}
                                isLoading={isProcessing}
                            />
                         </div>
                    )}
                    {mode === AppMode.INCINERATOR && (
                        <CyberButton 
                            label={isProcessing ? "PURGING..." : "INCINERATE DATA"} 
                            variant="danger" 
                            onClick={handleIncinerateClick}
                            disabled={files.length === 0 || isProcessing || isScanning}
                            isLoading={isProcessing}
                        />
                    )}
                </div>
            </div>
        </div>

        {/* Progress Bar */}
        {isProcessing && (
            <div className="h-1 w-full bg-gray-900">
                <div 
                    className="h-full bg-[#00E5FF] shadow-[0_0_10px_#00E5FF] transition-all duration-200" 
                    style={{ width: `${progress}%` }}
                />
            </div>
        )}

        {/* Terminal / Log */}
        <div className="bg-black border-t border-[#00E5FF] border-opacity-20 p-4 font-mono text-xs h-32 overflow-y-auto">
            <div className="flex items-center gap-2 text-gray-500 mb-2 border-b border-gray-800 pb-1">
                <Terminal className="w-3 h-3" />
                <span>SYSTEM_LOG</span>
            </div>
            <div className="space-y-1 text-[#00E5FF] opacity-80">
                {log.map((msg, i) => (
                    <div key={i} className="flex gap-2">
                        <span className="opacity-50 text-[10px]">{new Date().toLocaleTimeString()}</span>
                        <MatrixText text={msg} speed={30} />
                    </div>
                ))}
                <div ref={logEndRef} />
            </div>
        </div>

        {/* Incinerator Confirmation Modal */}
        {showConfirmModal && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                <div className="bg-[#0a0a0a] border border-red-500 shadow-[0_0_50px_rgba(220,38,38,0.3)] max-w-sm w-full relative overflow-hidden p-1">
                     {/* Warning Stripes */}
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 animate-pulse"></div>
                     <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 animate-pulse"></div>
                     
                     <div className="p-6 bg-red-950/10">
                        <div className="flex items-center gap-3 text-red-500 mb-4">
                            <div className="p-3 bg-red-500/10 rounded-full border border-red-500/30">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold tracking-wider leading-none">WARNING</h3>
                                <span className="text-[10px] text-red-400 tracking-[0.2em]">IRREVERSIBLE ACTION</span>
                            </div>
                        </div>
                        
                        <p className="text-gray-300 text-sm mb-6 leading-relaxed border-l-2 border-red-500/30 pl-4">
                            You are about to <strong className="text-red-400">PERMANENTLY INCINERATE</strong> {files.length} file(s) using DoD 5220.22-M algorithms.
                            <br/><br/>
                            This data will be unrecoverable.
                        </p>
                        
                        <div className="flex justify-end gap-3 pt-2">
                            <button 
                                onClick={() => setShowConfirmModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white border border-transparent hover:border-gray-600 transition-all text-xs font-bold uppercase"
                            >
                                Abort
                            </button>
                            <button 
                                onClick={handleIncinerateConfirm}
                                className="px-5 py-2 bg-red-600 text-black font-bold hover:bg-red-500 hover:shadow-[0_0_20px_#ef4444] transition-all text-xs uppercase flex items-center gap-2 group"
                            >
                                <Trash2 className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                                Confirm Incineration
                            </button>
                        </div>
                     </div>
                </div>
            </div>
        )}

        {/* About Modal */}
        {showAboutModal && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                <div className="bg-[#0a0a0a] border border-[#00E5FF] border-opacity-30 shadow-[0_0_50px_rgba(0,229,255,0.1)] max-w-lg w-full relative overflow-hidden flex flex-col max-h-[80vh]">
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b border-[#00E5FF] border-opacity-20 bg-[#00E5FF] bg-opacity-5">
                        <h3 className="text-[#00E5FF] font-bold tracking-widest flex items-center gap-2">
                            <Shield className="w-4 h-4" /> SYSTEM_INFO
                        </h3>
                        <button onClick={() => setShowAboutModal(false)} className="text-gray-500 hover:text-[#00E5FF] transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div className="p-6 overflow-y-auto space-y-6 text-sm">
                        <div>
                            <h4 className="text-[#00E5FF] font-bold mb-2 text-xs uppercase tracking-wider border-l-2 border-[#00E5FF] pl-2">Vortex Shield: Web Edition</h4>
                            <p className="text-gray-400 leading-relaxed text-xs">
                                A military-grade, browser-based encryption suite designed for secure data handling without server-side exposure. All cryptographic operations occur locally within your browser's memory using standard Web Crypto APIs.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <h4 className="text-gray-300 font-bold mb-2 text-[10px] uppercase tracking-wider">Core Protocols</h4>
                                <ul className="text-gray-500 space-y-1 list-disc list-inside text-[10px]">
                                    <li>AES-256-GCM / CBC</li>
                                    <li>PBKDF2 Key Derivation</li>
                                    <li>SHA-256 Integrity Hashing</li>
                                    <li>GZIP Compression</li>
                                </ul>
                             </div>
                             <div>
                                <h4 className="text-gray-300 font-bold mb-2 text-[10px] uppercase tracking-wider">Stealth Features</h4>
                                <ul className="text-gray-500 space-y-1 list-disc list-inside text-[10px]">
                                    <li>Steganography (Image Hiding)</li>
                                    <li>Camouflage Mode (Fake Ext)</li>
                                    <li>DoD 5220.22-M Incinerator</li>
                                    <li>Panic / Duress Mode</li>
                                </ul>
                             </div>
                        </div>

                        <div>
                            <h4 className="text-[#00E5FF] font-bold mb-2 text-xs uppercase tracking-wider border-l-2 border-[#00E5FF] pl-2">Usage Protocols</h4>
                            <div className="space-y-3">
                                <div className="bg-[#00E5FF] bg-opacity-5 p-3 rounded border border-[#00E5FF] border-opacity-10">
                                    <strong className="text-gray-300 block text-xs mb-1">ENCRYPTION</strong>
                                    <p className="text-gray-500 text-[10px]">Select files -> Choose Algorithm -> Enter Strong Password -> (Optional) Add Keyfile/Compression -> Activate Shield.</p>
                                </div>
                                <div className="bg-[#00E5FF] bg-opacity-5 p-3 rounded border border-[#00E5FF] border-opacity-10">
                                    <strong className="text-gray-300 block text-xs mb-1">DECRYPTION</strong>
                                    <p className="text-gray-500 text-[10px]">Select Encrypted File (.vortex) -> Enter Original Password -> (Required) Upload Keyfile if used -> Unlock Vault.</p>
                                </div>
                            </div>
                        </div>
                        
                         <div className="text-center pt-4 border-t border-gray-800">
                            <p className="text-[10px] text-gray-600">VERSION 3.1.0 // BUILD 2024.10.27</p>
                         </div>
                    </div>
                </div>
            </div>
        )}

      </div>
      
      {/* Footer Decoration */}
      <div className="mt-4 text-[10px] text-gray-600 tracking-[0.2em] animate-pulse mb-8 flex items-center gap-2">
          SECURE CONNECTION ESTABLISHED // NODE_ID: 8X-99
          {resumeAvailable && <span className="text-[#00E5FF]">| RESUME_READY</span>}
      </div>

      {/* Developer Footer */}
      <div className="mt-4 flex flex-col items-center gap-5 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="relative group cursor-default">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#00E5FF] to-[#ff00c1] rounded blur opacity-20 group-hover:opacity-60 transition duration-500"></div>
              <div className="relative px-5 py-2 bg-black/80 ring-1 ring-[#00E5FF] ring-opacity-20 rounded flex items-center gap-3 backdrop-blur-sm transition-transform group-hover:-translate-y-0.5">
                 <Code className="w-4 h-4 text-[#00E5FF] animate-pulse" />
                 <span className="text-xs font-mono text-[#00E5FF] tracking-widest cyber-glitch font-bold" data-text="ZAHID HASAN TONMOY">ZAHID HASAN TONMOY</span>
              </div>
          </div>
          
          <div className="flex items-center gap-6">
             {[
                 { icon: Facebook, href: "https://www.facebook.com/zahidhasantonmoybd", color: "hover:text-blue-500" },
                 { icon: Linkedin, href: "https://www.linkedin.com/in/zahidhasantonmoy/", color: "hover:text-blue-400" },
                 { icon: Github, href: "https://github.com/zahidhasantonmoy", color: "hover:text-purple-500" },
                 { icon: Globe, href: "https://zahidhasantonmoy.vercel.app", color: "hover:text-[#00E5FF]" }
             ].map((item, idx) => (
                <a 
                    key={idx} 
                    href={item.href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`text-gray-600 transition-all duration-300 transform hover:scale-125 ${item.color} relative group`}
                >
                    <span className="absolute -inset-2 bg-white/10 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    <item.icon className="w-5 h-5 relative z-10" />
                </a>
             ))}
          </div>
      </div>
    </div>
  );
};

export default App;