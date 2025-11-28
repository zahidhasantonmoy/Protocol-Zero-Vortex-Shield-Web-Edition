import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Unlock, Eye, Trash2, AlertTriangle, Terminal, FileCode, Loader2, FileText, FileLock, Github, Linkedin, Facebook, Globe, Code, Settings, RotateCcw, X, Clock } from 'lucide-react';
import MatrixText from './components/MatrixText';
import CyberButton from './components/CyberButton';
import DropZone from './components/DropZone';
import { deriveMasterKey, encryptChunk, decryptChunk, findDelimiterIndex, STEGANO_DELIMITER, CryptoAlgorithm } from './utils/crypto';
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
  const [file, setFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>(['> SYSTEM INITIALIZED', '> VORTEX SHIELD v3.0 ONLINE']);
  const [duressMode, setDuressMode] = useState(false);
  const [showFakeSuccess, setShowFakeSuccess] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Advanced Settings
  const [camouflageMode, setCamouflageMode] = useState(false);
  const [camouflageExt, setCamouflageExt] = useState('.dll');
  const [algorithm, setAlgorithm] = useState<CryptoAlgorithm>('AES-GCM');
  const [resumeAvailable, setResumeAvailable] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef<boolean>(false);

  const fakeExtensions = ['.dll', '.sys', '.dat', '.tmp', '.ini', '.bin'];

  // --- Effects ---

  // 1. Sync isProcessing state to ref for timer checks
  useEffect(() => {
    processingRef.current = isProcessing;
  }, [isProcessing]);

  // 2. Load State from LocalStorage
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            // Check if there is valid state to resume
            if (parsed.mode || parsed.algorithm || parsed.password) {
                setResumeAvailable(true);
            }
        } catch (e) {
            console.error("Failed to load state", e);
        }
    }
  }, []);

  // 3. Save State Logic
  const stateRef = useRef({ mode, file, password, algorithm, camouflageMode, camouflageExt });
  
  useEffect(() => {
    stateRef.current = { mode, file, password, algorithm, camouflageMode, camouflageExt };
  }, [mode, file, password, algorithm, camouflageMode, camouflageExt]);

  const saveCurrentState = () => {
      const s = stateRef.current;
      const stateToSave = {
          mode: s.mode,
          algorithm: s.algorithm,
          camouflageMode: s.camouflageMode,
          camouflageExt: s.camouflageExt,
          fileDetails: s.file ? { name: s.file.name, size: s.file.size } : null,
          password: s.password, 
          timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  };

  // 3a. Save on User Actions
  useEffect(() => {
      saveCurrentState();
  }, [mode, algorithm, camouflageMode, camouflageExt, file, password]);

  // 3b. Save on Regular Intervals
  useEffect(() => {
      const interval = setInterval(saveCurrentState, 30000);
      return () => clearInterval(interval);
  }, []);

  // 4. Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // 5. Inactivity Timer
  useEffect(() => {
    const handleInactivityTimeout = () => {
        if (processingRef.current) {
            resetTimer(); 
            return; 
        }
        
        setPassword('');
        setFile(null);
        setCoverImage(null);
        setShowConfirmModal(false);
        addLog('WARNING: SESSION TIMEOUT. SECURE DATA CLEARED.');
        playSound('error');
    };

    const resetTimer = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(handleInactivityTimeout, INACTIVITY_LIMIT_MS);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('dragover', resetTimer);

    resetTimer();

    return () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        window.removeEventListener('mousemove', resetTimer);
        window.removeEventListener('keydown', resetTimer);
        window.removeEventListener('click', resetTimer);
        window.removeEventListener('dragover', resetTimer);
    };
  }, []); 

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
              if (parsed.password) setPassword(parsed.password);
              
              setResumeAvailable(false);
              addLog('> SESSION SETTINGS RESTORED');
              if (parsed.fileDetails) {
                addLog(`> PENDING: RE-SELECT FILE ${parsed.fileDetails.name}`);
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

  const handleFileSelect = (selectedFile: File) => {
      setIsScanning(true);
      setFile(null);
      addLog(`SCANNING FILE: ${selectedFile.name}...`);
      playSound('process');
      setTimeout(() => {
          setFile(selectedFile);
          setIsScanning(false);
          addLog(`FILE VERIFIED: ${(selectedFile.size/1024/1024).toFixed(2)} MB`);
          playSound('success');
      }, 800);
  };

  const handleCoverSelect = (selectedFile: File) => {
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
    if (val === 'panic') {
      triggerDuressMode();
    }
  };

  const triggerDuressMode = () => {
    setDuressMode(true);
    addLog('CRITICAL: DURESS SIGNAL DETECTED');
    addLog('ENGAGING DECOY PROTOCOLS...');
    setTimeout(() => {
        setFile(null);
        setCoverImage(null);
        setMode(AppMode.DECRYPT);
        setPassword('');
    }, 1000);
  };

  // HEADER CONSTANTS
  const VORTEX_MAGIC = "VORTEX"; // 6 bytes
  const VERSION = 1;

  // --- CORE CHUNKED ENCRYPTION LOGIC ---
  const executeChunkedEncryption = async (inputFile: File, coverFile: File | null = null) => {
      setIsProcessing(true);
      setProgress(0);
      addLog('INITIALIZING CHUNKED ENCRYPTION ENGINE...');

      try {
          const salt = window.crypto.getRandomValues(new Uint8Array(16));
          const key = await deriveMasterKey(password, salt, algorithm);
          
          const blobParts: (Blob | ArrayBuffer | Uint8Array)[] = [];
          
          // 1. If Stegano, Append Cover Image + Delimiter first
          if (coverFile) {
              addLog('PROCESSING COVER IMAGE...');
              blobParts.push(coverFile);
              const encoder = new TextEncoder();
              blobParts.push(encoder.encode(STEGANO_DELIMITER));
          }

          // 2. Add Global Header: [Magic(6)] [Ver(1)] [Algo(1)] [Salt(16)]
          const encoder = new TextEncoder();
          const magicBytes = encoder.encode(VORTEX_MAGIC);
          const versionByte = new Uint8Array([VERSION]);
          const algoByte = new Uint8Array([algorithm === 'AES-GCM' ? 1 : 2]); 
          
          blobParts.push(magicBytes, versionByte, algoByte, salt);

          // 3. Process File Chunks
          const totalSize = inputFile.size;
          let offset = 0;
          let chunkIndex = 0;

          while (offset < totalSize) {
              // Read chunk
              const slice = inputFile.slice(offset, offset + CHUNK_SIZE);
              const chunkBuffer = await slice.arrayBuffer();
              
              // Encrypt Chunk
              // Format per chunk: [Len(4)][IV(12/16)][Ciphertext]
              const { encrypted, iv } = await encryptChunk(chunkBuffer, key, algorithm);
              
              const lenBuffer = new DataView(new ArrayBuffer(4));
              lenBuffer.setUint32(0, encrypted.byteLength, false); // Big Endian Length
              
              blobParts.push(lenBuffer.buffer);
              blobParts.push(iv);
              blobParts.push(encrypted);

              // Update Progress
              offset += CHUNK_SIZE;
              chunkIndex++;
              const percent = Math.min(99, Math.round((offset / totalSize) * 100));
              setProgress(percent);
              
              // Yield to main thread to keep UI responsive
              await new Promise(r => setTimeout(r, 0));
          }

          // 4. Finalize
          addLog('FINALIZING BLOB ASSEMBLY...');
          const finalBlob = new Blob(blobParts, { type: coverFile ? 'image/png' : 'application/octet-stream' });
          
          // Determine Filename
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
          setProgress(100);
          addLog('OPERATION COMPLETE.');
          playSound('success');

      } catch (e: any) {
          addLog(`ERROR: ${e.message}`);
          playSound('error');
      } finally {
          setIsProcessing(false);
      }
  };

  // --- CORE CHUNKED DECRYPTION LOGIC ---
  const executeChunkedDecryption = async (inputBlob: Blob, isStegano: boolean) => {
      setIsProcessing(true);
      setProgress(0);
      addLog('INITIALIZING DECRYPTION STREAM...');

      try {
          // 1. Locate Payload Start
          let payloadOffset = 0;
          if (isStegano) {
              addLog('SCANNING FOR HIDDEN PAYLOAD MARKER...');
              // Only scan the first 50MB for the delimiter to avoid loading huge files
              const scanSize = Math.min(inputBlob.size, 50 * 1024 * 1024);
              const scanBuffer = await inputBlob.slice(0, scanSize).arrayBuffer();
              const scanUint8 = new Uint8Array(scanBuffer);
              const delimiterBytes = new TextEncoder().encode(STEGANO_DELIMITER);
              
              const delimiterIdx = findDelimiterIndex(scanUint8, delimiterBytes);
              
              if (delimiterIdx === -1) {
                  throw new Error("NO STEGANOGRAPHY PAYLOAD FOUND");
              }
              payloadOffset = delimiterIdx + delimiterBytes.length;
          }

          // 2. Read Global Header
          // Header Size: 6(Magic) + 1(Ver) + 1(Algo) + 16(Salt) = 24 bytes
          const headerSize = 24;
          const headerSlice = inputBlob.slice(payloadOffset, payloadOffset + headerSize);
          const headerBuffer = await headerSlice.arrayBuffer();
          const headerView = new Uint8Array(headerBuffer);
          const encoder = new TextEncoder();
          const magicBytes = encoder.encode(VORTEX_MAGIC);

          // Verify Magic Signature
          for(let i=0; i<magicBytes.length; i++) {
              if (headerView[i] !== magicBytes[i]) {
                  throw new Error("INVALID FILE FORMAT OR HEADER");
              }
          }

          const algoId = headerView[7];
          const usedAlgo = algoId === 2 ? 'AES-CBC' : 'AES-GCM';
          const salt = headerView.slice(8, 24);

          addLog(`HEADER VERIFIED. ALGO: ${usedAlgo}`);

          // 3. Derive Key
          const key = await deriveMasterKey(password, salt, usedAlgo);
          const decryptedParts: ArrayBuffer[] = [];

          // 4. Loop Chunks
          let offset = payloadOffset + headerSize;
          const totalSize = inputBlob.size;
          const ivLen = usedAlgo === 'AES-GCM' ? 12 : 16;

          while (offset < totalSize) {
              // Read Length (4 bytes)
              const lenSlice = inputBlob.slice(offset, offset + 4);
              if (lenSlice.size < 4) break;
              const lenBuffer = await lenSlice.arrayBuffer();
              const chunkLen = new DataView(lenBuffer).getUint32(0, false);
              offset += 4;

              // Read IV
              const ivSlice = inputBlob.slice(offset, offset + ivLen);
              const iv = new Uint8Array(await ivSlice.arrayBuffer());
              offset += ivLen;

              // Read Ciphertext
              const cipherSlice = inputBlob.slice(offset, offset + chunkLen);
              const cipherBuffer = await cipherSlice.arrayBuffer();
              offset += chunkLen;

              // Decrypt
              const decryptedChunk = await decryptChunk(cipherBuffer, key, iv, usedAlgo);
              decryptedParts.push(decryptedChunk);

              // Progress
              const percent = Math.min(99, Math.round(((offset - payloadOffset) / (totalSize - payloadOffset)) * 100));
              setProgress(percent);
              await new Promise(r => setTimeout(r, 0));
          }

          // 5. Finalize
          const finalBlob = new Blob(decryptedParts);
          
          let dlName = file!.name.replace('.vortex', '').replace(camouflageExt, '');
          if (isStegano) dlName = "revealed_payload.bin";

          downloadBlob(finalBlob, dlName);
          setProgress(100);
          addLog('DECRYPTION SUCCESSFUL.');
          playSound('success');

      } catch (e: any) {
          addLog(`ERROR: ${e.message}`);
          playSound('error');
      } finally {
          setIsProcessing(false);
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
    if (!file || !password) return;
    await executeChunkedEncryption(file);
  };

  const handleDecrypt = async () => {
      if (!file || !password) return;
      if (duressMode) {
          setIsProcessing(true);
          await new Promise(r => setTimeout(r, 2000));
          setIsProcessing(false);
          setShowFakeSuccess(true);
          return;
      }
      await executeChunkedDecryption(file, false);
  };

  const handleStegano = async () => {
      if (!file || !coverImage || !password) return;
      addLog(`EMBEDDING PAYLOAD INTO ${coverImage.name}`);
      await executeChunkedEncryption(file, coverImage);
  };

  const handleSteganoDecrypt = async () => {
      if (!file || !password) return;
      await executeChunkedDecryption(file, true);
  };

  const handleIncinerateClick = () => {
      if (!file) return;
      setShowConfirmModal(true);
  };

  const handleIncinerateConfirm = async () => {
      setShowConfirmModal(false);
      if(!file) return;
      setIsProcessing(true);
      
      addLog(`INITIATING DATA INCINERATION: ${file.name}`);
      // Simulate DoD 3-pass overwrite time delay
      for(let i=0; i<3; i++) {
          setProgress(((i+1)/3)*100);
          addLog(`PASS ${i+1}/3: OVERWRITING SECTORS...`);
          await new Promise(r => setTimeout(r, 800));
      }
      addLog('FILE BUFFER PURGED.');
      setFile(null);
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

  const renderFileDetail = (currentFile: File, onClear: () => void, icon?: React.ReactNode) => (
    <div className="flex items-center gap-3 bg-[#00E5FF]/5 border border-[#00E5FF]/20 p-3 rounded mt-2 mb-4 animate-in fade-in slide-in-from-top-2 shadow-[0_0_10px_rgba(0,229,255,0.05)]">
         <div className="p-2 bg-[#00E5FF]/10 rounded flex-shrink-0">
             {icon || <FileText className="w-5 h-5 text-[#00E5FF]" />}
         </div>
         <div className="flex-1 min-w-0">
            <div className="text-[#00E5FF] text-sm font-bold truncate tracking-wide">{currentFile.name}</div>
            <div className="text-gray-500 text-xs font-mono flex items-center gap-2">
                <span>{(currentFile.size / 1024 / 1024).toFixed(2)} MB</span>
                <span className="text-[#00E5FF]/30">|</span>
                <span className="uppercase">{currentFile.type || 'UNKNOWN TYPE'}</span>
            </div>
         </div>
         <button 
            onClick={(e) => {
                e.stopPropagation();
                onClear();
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
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0, 229, 255, .3) 25%, rgba(0, 229, 255, .3) 26%, transparent 27%, transparent 74%, rgba(0, 229, 255, .3) 75%, rgba(0, 229, 255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 229, 255, .3) 25%, rgba(0, 229, 255, .3) 26%, transparent 27%, transparent 74%, rgba(0, 229, 255, .3) 75%, rgba(0, 229, 255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 229, 255, .3) 25%, rgba(0, 229, 255, .3) 26%, transparent 27%, transparent 74%, rgba(0, 229, 255, .3) 75%, rgba(0, 229, 255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 229, 255, .3) 25%, rgba(0, 229, 255, .3) 26%, transparent 27%, transparent 74%, rgba(0, 229, 255, .3) 75%, rgba(0, 229, 255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 229, 255, .3) 25%, rgba(0, 229, 255, .3) 26%, transparent 27%, transparent 74%, rgba(0, 229, 255, .3) 75%, rgba(0, 229, 255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 229, 255, .3) 25%, rgba(0, 229, 255, .3) 26%, transparent 27%, transparent 74%, rgba(0, 229, 255, .3) 75%, rgba(0, 229, 255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 229, 255, .3) 25%, rgba(0, 229, 255, .3) 26%, transparent 27%, transparent 74%, rgba(0, 229, 255, .3) 75%, rgba(0, 229, 255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 229, 255, .3) 25%, rgba(0, 229, 255, .3) 26%, transparent 27%, transparent 74%, rgba(0, 229, 255, .3) 75%, rgba(0, 229, 255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 229, 255, .3) 25%, rgba(0, 229, 255, .3) 26%, transparent 27%, transparent 74%, rgba(0, 229, 255, .3) 75%, rgba(0, 229, 255, .3) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px'
      }}></div>

      {/* Main Window */}
      <div className="w-full max-w-2xl bg-[#0a0a0a] border border-[#00E5FF]/30 shadow-[0_0_50px_rgba(0,229,255,0.1)] rounded-sm relative overflow-hidden backdrop-blur-md z-20">
        
        {/* Header Bar */}
        <div className="bg-[#00E5FF]/10 p-3 flex justify-between items-center border-b border-[#00E5FF]/20 select-none">
            <div className="flex items-center gap-2 text-[#00E5FF]">
                <Shield className="w-5 h-5 animate-pulse" />
                <span className="font-bold tracking-widest text-sm">VORTEX SHIELD <span className="text-[10px] opacity-70">ULTIMATE_EDITION_V3</span></span>
            </div>
            
            {resumeAvailable && (
                <button 
                    onClick={handleResumeSession}
                    className="flex items-center gap-1 text-[10px] bg-[#00E5FF]/10 text-[#00E5FF] px-2 py-1 rounded border border-[#00E5FF]/30 hover:bg-[#00E5FF]/20 transition-colors animate-pulse"
                >
                    <RotateCcw className="w-3 h-3" />
                    RESUME_SESSION
                </button>
            )}

            <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
            </div>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-4 border-b border-[#00E5FF]/20 text-xs sm:text-sm">
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
                        setFile(null);
                        setCoverImage(null);
                        setLog([]);
                        setPassword('');
                        setShowConfirmModal(false);
                        addLog(`SWITCHING MODE TO ${item.id}...`);
                    }}
                    className={`p-3 flex flex-col items-center gap-1 transition-colors ${mode === item.id ? 'bg-[#00E5FF] text-black font-bold' : 'text-gray-400 hover:text-[#00E5FF] hover:bg-[#00E5FF]/5'}`}
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
                        onFileSelect={handleCoverSelect} 
                        label="DROP COVER IMAGE (.PNG/.JPG)"
                        accept="image/*"
                        selectedFile={coverImage}
                    />
                    {isScanning && !coverImage && !file && (
                        <div className="text-center text-[#00E5FF] text-xs animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                            ANALYZING BITMAP STRUCTURE...
                        </div>
                    )}
                    {coverImage && !isScanning && renderFileDetail(coverImage, () => setCoverImage(null), <FileCode className="w-5 h-5 text-[#00E5FF]" />)}
                </>
            )}

            {/* Main File Drop */}
            <DropZone 
                onFileSelect={handleFileSelect} 
                label={mode === AppMode.STEGANO ? "DROP PAYLOAD FILE" : "DROP TARGET FILE"}
            />
            {isScanning && !file && (
                 <div className="text-center text-[#00E5FF] text-xs animate-pulse">
                     <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                     VERIFYING INTEGRITY...
                 </div>
            )}
            {file && !isScanning && renderFileDetail(file, () => setFile(null), mode === AppMode.STEGANO ? <FileLock className="w-5 h-5 text-[#00E5FF]" /> : <Shield className="w-5 h-5 text-[#00E5FF]" />)}

            {/* Algorithm Selector (Encrypt/Stegano only) */}
            {(mode === AppMode.ENCRYPT || mode === AppMode.STEGANO) && (
                <div className="flex items-center gap-3 bg-[#00E5FF]/5 border border-[#00E5FF]/20 p-2 rounded">
                    <Settings className="w-4 h-4 text-[#00E5FF]" />
                    <span className="text-xs text-gray-400 font-bold tracking-wider">ALGORITHM:</span>
                    <div className="flex gap-2">
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

            {/* Password Field */}
            {mode !== AppMode.INCINERATOR && (
                <div className="relative group">
                    <label className="text-[10px] uppercase text-gray-500 mb-1 block tracking-wider">Passphrase / Key</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={handlePasswordChange}
                        placeholder="ENTER SECURE KEY..."
                        className="w-full bg-black/50 border border-[#00E5FF]/30 p-3 text-[#00E5FF] focus:outline-none focus:border-[#00E5FF] focus:shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all placeholder-gray-700 font-mono"
                    />
                    <div className="absolute right-3 top-8 text-[#00E5FF]/30">
                        <Lock className="w-4 h-4" />
                    </div>
                </div>
            )}

            {/* Camouflage Mode Option (Encrypt Only) */}
            {mode === AppMode.ENCRYPT && (
                 <div className="bg-[#00E5FF]/5 border border-[#00E5FF]/20 p-3 rounded transition-all">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#00E5FF]/80">
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
                            <div className="w-9 h-5 bg-gray-900 peer-focus:outline-none rounded-full peer border border-gray-700 peer-checked:border-[#00E5FF] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00E5FF]/20 peer-checked:after:bg-[#00E5FF]"></div>
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
                                    className="w-full bg-black/50 border border-[#00E5FF]/30 text-[#00E5FF] text-xs p-2 rounded focus:border-[#00E5FF] focus:outline-none focus:shadow-[0_0_10px_rgba(0,229,255,0.2)] font-mono placeholder-gray-700"
                                    placeholder="CUSTOM EXTENSION (E.G. .XYZ)"
                                />
                            </div>
                        </div>
                    )}
                 </div>
            )}

            {/* Actions */}
            <div className="flex justify-end items-center gap-4 pt-4 border-t border-[#00E5FF]/10">
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
                        disabled={!file || !password || isProcessing || isScanning} 
                        isLoading={isProcessing}
                    />
                )}
                {mode === AppMode.DECRYPT && (
                    <CyberButton 
                        label={isProcessing ? "DECRYPTING..." : "UNLOCK VAULT"} 
                        onClick={handleDecrypt}
                        disabled={!file || !password || isProcessing || isScanning}
                        isLoading={isProcessing}
                    />
                )}
                {mode === AppMode.STEGANO && (
                     <div className="flex gap-2">
                         <CyberButton 
                            label="EXTRACT" 
                            variant="ghost"
                            onClick={handleSteganoDecrypt}
                            disabled={!file || !password || isProcessing || isScanning}
                            isLoading={isProcessing}
                        />
                         <CyberButton 
                            label="EMBED" 
                            onClick={handleStegano}
                            disabled={!file || !coverImage || !password || isProcessing || isScanning}
                            isLoading={isProcessing}
                        />
                     </div>
                )}
                {mode === AppMode.INCINERATOR && (
                    <CyberButton 
                        label={isProcessing ? "PURGING..." : "INCINERATE DATA"} 
                        variant="danger" 
                        onClick={handleIncinerateClick}
                        disabled={!file || isProcessing || isScanning}
                        isLoading={isProcessing}
                    />
                )}
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
        <div className="bg-black border-t border-[#00E5FF]/20 p-4 font-mono text-xs h-32 overflow-y-auto">
            <div className="flex items-center gap-2 text-gray-500 mb-2 border-b border-gray-800 pb-1">
                <Terminal className="w-3 h-3" />
                <span>SYSTEM_LOG</span>
            </div>
            <div className="space-y-1 text-[#00E5FF]/80">
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
                            You are about to <strong className="text-red-400">PERMANENTLY INCINERATE</strong> this file using DoD 5220.22-M algorithms.
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
              <div className="relative px-5 py-2 bg-black/80 ring-1 ring-[#00E5FF]/20 rounded flex items-center gap-3 backdrop-blur-sm transition-transform group-hover:-translate-y-0.5">
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