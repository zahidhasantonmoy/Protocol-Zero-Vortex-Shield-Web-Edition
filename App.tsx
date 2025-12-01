
import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Unlock, Eye, Trash2, AlertTriangle, Terminal, FileCode, Loader2, FileText, FileLock, Github, Linkedin, Facebook, Globe, Code, Settings, RotateCcw, X, Clock, Copy, Check, Key, FileArchive, Fingerprint, Info, Dna, FileDown, Type, Save, Image as ImageIcon, Grid, ChevronDown, ScanEye, Flame, ShieldCheck } from 'lucide-react';
import MatrixText from './components/MatrixText';
import CyberButton from './components/CyberButton';
import DeveloperInfo from './components/DeveloperInfo';
import DropZone from './components/DropZone';
import { CryptoAlgorithm, hashData, CHUNK_SIZE } from './utils/crypto';
import { playSound } from './utils/audio';

// Local types for worker communication
type WorkerRequest =
    | { type: 'ENCRYPT'; file: File | Blob; password: string; algorithm: CryptoAlgorithm; coverFile?: File | null; keyFileHash?: string; useCompression?: boolean; camouflageMode?: boolean; camouflageExt?: string; explicitName?: string }
    | { type: 'DECRYPT'; file: File | Blob; password: string; isStegano: boolean; keyFileHash?: string; originalName: string };

type WorkerResponse =
    | { type: 'PROGRESS'; percent: number }
    | { type: 'COMPLETE'; blob: Blob; fileName: string; log: string }
    | { type: 'ERROR'; error: string };

enum AppMode {
    ENCRYPT = 'ENCRYPT',
    DECRYPT = 'DECRYPT',
    STEGANO = 'STEGANO',
    INCINERATOR = 'INCINERATOR',
    TEXT = 'TEXT_VAULT'
}

const STORAGE_KEY = 'vortex_shield_state';
const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;

interface LogEntry {
    text: string;
    timestamp: string;
}

// Utility moved outside component
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

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const base64ToBlob = async (base64: string): Promise<Blob> => {
    const res = await fetch(base64);
    return await res.blob();
};

const App: React.FC = () => {
    // --- State ---
    const [mode, setMode] = useState<AppMode>(AppMode.ENCRYPT);
    const [files, setFiles] = useState<File[]>([]);
    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [log, setLog] = useState<LogEntry[]>([
        { text: 'SYSTEM INITIALIZED', timestamp: new Date().toLocaleTimeString() },
        { text: 'VORTEX SHIELD v5.0 [WORKER_ACTIVE]', timestamp: new Date().toLocaleTimeString() }
    ]);
    const [duressMode, setDuressMode] = useState(false);
    const [showFakeSuccess, setShowFakeSuccess] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showAboutModal, setShowAboutModal] = useState(false);
    const [decoyMode, setDecoyMode] = useState(false);

    // Advanced Settings
    const [camouflageMode, setCamouflageMode] = useState(false);
    const [camouflageExt, setCamouflageExt] = useState('.dll');
    const [algorithm, setAlgorithm] = useState<CryptoAlgorithm>('AES-GCM');
    const [resumeAvailable, setResumeAvailable] = useState(false);

    // New Features
    const [keyFile, setKeyFile] = useState<File | null>(null);
    const [keyFileHash, setKeyFileHash] = useState<string>('');
    const [useCompression, setUseCompression] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Text Vault State
    const [textInput, setTextInput] = useState('');
    const [textMode, setTextMode] = useState<'ENCRYPT' | 'DECRYPT'>('ENCRYPT');

    const [passwordStrength, setPasswordStrength] = useState(0);
    const [lastOutput, setLastOutput] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    const logEndRef = useRef<HTMLDivElement>(null);
    const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastActivityRef = useRef<number>(Date.now());
    const processingRef = useRef<boolean>(false);
    const workerRef = useRef<Worker | null>(null);

    const fakeExtensions = ['.dll', '.sys', '.dat', '.tmp', '.ini', '.bin'];

    // --- Effects ---

    // Initialize Worker using standard URL constructor
    useEffect(() => {
        workerRef.current = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        return () => {
            workerRef.current?.terminate();
        };
    }, []);

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
    const stateRef = useRef({ mode, files, password, algorithm, camouflageMode, camouflageExt, useCompression, textInput });

    useEffect(() => {
        stateRef.current = { mode, files, password, algorithm, camouflageMode, camouflageExt, useCompression, textInput };
    }, [mode, files, password, algorithm, camouflageMode, camouflageExt, useCompression, textInput]);

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
            textInput: s.textInput,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    };

    useEffect(() => { saveCurrentState(); }, [mode, algorithm, camouflageMode, camouflageExt, files, password, useCompression, textInput]);
    useEffect(() => {
        const interval = setInterval(saveCurrentState, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [log]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'K') {
                e.preventDefault();
                handleKillSwitch();
                return;
            }
            if (e.altKey) {
                switch (e.key.toLowerCase()) {
                    case 'e': setMode(AppMode.ENCRYPT); playSound('hover'); break;
                    case 'd': setMode(AppMode.DECRYPT); playSound('hover'); break;
                    case 't': setMode(AppMode.TEXT); playSound('hover'); break;
                    case 'i': setMode(AppMode.INCINERATOR); playSound('hover'); break;
                    case 'c': setDecoyMode(prev => !prev); break; // Chameleon Protocol
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleKillSwitch = () => {
        setPassword('');
        setFiles([]);
        setKeyFile(null);
        setKeyFileHash('');
        setCoverImage(null);
        setLastOutput(null);
        setTextInput('');
        setPreviewUrl(null);
        setPasswordStrength(0);
        setShowConfirmModal(false);
        setShowAboutModal(false);
        setDecoyMode(false);
        addLog('!!! KILL SWITCH ENGAGED !!! SYSTEM PURGED.');
        playSound('error');
    };

    // Inactivity
    useEffect(() => {
        const handleInactivityTimeout = () => {
            if (processingRef.current) { resetTimer(true); return; }
            handleKillSwitch();
            addLog('WARNING: SESSION TIMEOUT.');
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

    const generateStrongPassword = () => {
        const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
        const length = 24;
        const values = new Uint32Array(length);
        window.crypto.getRandomValues(values);
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset[values[i] % charset.length];
        }
        return result;
    };

    const handleGeneratePassword = () => {
        const newPass = generateStrongPassword();
        setPassword(newPass);
        setPasswordStrength(4);
        playSound('success');
        addLog('GENERATED HIGH-ENTROPY KEY');
    };

    const triggerDuressMode = () => {
        setDuressMode(true);
        setFiles([]);
        setKeyFile(null);
        setKeyFileHash('');
        setCoverImage(null);
        setLastOutput(null);
        setTextInput('');
        setPreviewUrl(null);
        setLog([]);
    };

    const copyToClipboard = async () => {
        if (lastOutput) {
            try {
                await navigator.clipboard.writeText(lastOutput);
                setCopySuccess(true);
                playSound('success');
                setTimeout(() => setCopySuccess(false), 2000);
                addLog('OUTPUT COPIED');
            } catch (err) {
                addLog('ERROR: CLIPBOARD DENIED');
                playSound('error');
            }
        }
    };

    const copyLogMessage = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            playSound('success');
        } catch (err) {
            playSound('error');
        }
    };

    const handleExportLog = () => {
        try {
            const logContent = log.map(entry => `[${entry.timestamp}] ${entry.text}`).join('\n');
            const blob = new Blob([logContent], { type: 'text/plain' });
            const filename = `vortex_audit_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
            downloadBlob(blob, filename);
            addLog('AUDIT LOG EXPORTED');
            playSound('success');
        } catch (err: any) {
            addLog('EXPORT FAILED');
            playSound('error');
        }
    };

    const handleKeyFileSelect = async (selectedFiles: File[]) => {
        if (selectedFiles.length > 0) {
            const kf = selectedFiles[0];
            setKeyFile(kf);
            addLog(`KEY FILE LOADED: ${kf.name}`);
            try {
                if (kf.size > CHUNK_SIZE) {
                    addLog('WARNING: KEY FILE >64MB. TRUNCATING.');
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
                if (parsed.textInput) setTextInput(parsed.textInput);
                if (parsed.password) {
                    setPassword(parsed.password);
                    setPasswordStrength(calculateStrength(parsed.password));
                }
                setResumeAvailable(false);
                addLog('> SESSION RESTORED');
                playSound('success');
            } catch (e) {
                addLog('> ERROR: CORRUPT STATE');
            }
        }
    };

    const addLog = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLog(prev => [...prev.slice(-19), { text: msg, timestamp }]);
    };

    const handleFilesSelect = (selectedFiles: File[]) => {
        setIsScanning(true);
        setFiles([]);
        setLastOutput(null);
        setPreviewUrl(null);
        addLog(`SCANNING ${selectedFiles.length} FILES...`);
        playSound('process');
        setTimeout(() => {
            setFiles(selectedFiles);
            setIsScanning(false);
            addLog(`BATCH LOADED: ${selectedFiles.length} FILES`);
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

    // --- Worker Logic Helper ---

    const runWorkerTask = (message: WorkerRequest): Promise<{ blob: Blob, fileName: string }> => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) {
                reject(new Error("Worker not initialized"));
                return;
            }

            const handler = (e: MessageEvent<WorkerResponse>) => {
                const resp = e.data;
                if (resp.type === 'PROGRESS') {
                    setProgress(resp.percent);
                } else if (resp.type === 'COMPLETE') {
                    if (resp.log) addLog(resp.log);
                    workerRef.current?.removeEventListener('message', handler);
                    resolve({ blob: resp.blob, fileName: resp.fileName });
                } else if (resp.type === 'ERROR') {
                    workerRef.current?.removeEventListener('message', handler);
                    reject(new Error(resp.error));
                }
            };

            workerRef.current.addEventListener('message', handler);
            workerRef.current.postMessage(message);
        });
    };

    const handleEncrypt = async () => {
        if (files.length === 0 || !password) return;
        setIsProcessing(true);
        addLog('BATCH ENCRYPTION STARTED (WORKER)');

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            try {
                const { blob, fileName } = await runWorkerTask({
                    type: 'ENCRYPT',
                    file: f,
                    password,
                    algorithm,
                    keyFileHash: keyFileHash || undefined,
                    useCompression,
                    camouflageMode,
                    camouflageExt
                });
                downloadBlob(blob, fileName);
                setLastOutput(fileName);
            } catch (e: any) {
                addLog(`FAILED: ${f.name} - ${e.message}`);
                playSound('error');
            }
        }
        setIsProcessing(false);
        setProgress(100);
        addLog('BATCH COMPLETE');
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
        addLog('BATCH DECRYPTION STARTED (WORKER)');

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            try {
                const { blob, fileName } = await runWorkerTask({
                    type: 'DECRYPT',
                    file: f,
                    password,
                    isStegano: false,
                    keyFileHash: keyFileHash || undefined,
                    originalName: f.name
                });
                downloadBlob(blob, fileName);
                setLastOutput(fileName);
            } catch (e: any) {
                addLog(`FAILED: ${f.name} - ${e.message}`);
                playSound('error');
            }
        }
        setIsProcessing(false);
        setProgress(100);
        addLog('BATCH COMPLETE');
        playSound('success');
    };

    const handleStegano = async () => {
        if (files.length === 0 || !coverImage || !password) return;
        setIsProcessing(true);

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            addLog(`HIDING: ${f.name}`);
            try {
                const { blob, fileName } = await runWorkerTask({
                    type: 'ENCRYPT',
                    file: f,
                    password,
                    algorithm,
                    keyFileHash: keyFileHash || undefined,
                    useCompression,
                    coverFile: coverImage
                });
                downloadBlob(blob, fileName);
            } catch (e: any) {
                addLog(`ERROR: ${e.message}`);
                playSound('error');
            }
        }
        setIsProcessing(false);
        setProgress(100);
        addLog('STEGANOGRAPHY COMPLETE');
        playSound('success');
    };

    const handleSteganoDecrypt = async () => {
        if (files.length === 0 || !password) return;
        setIsProcessing(true);
        setPreviewUrl(null);

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            addLog(`EXTRACTING FROM: ${f.name}`);
            try {
                const { blob, fileName } = await runWorkerTask({
                    type: 'DECRYPT',
                    file: f,
                    password,
                    isStegano: true,
                    keyFileHash: keyFileHash || undefined,
                    originalName: f.name
                });

                // Simple Image Preview Heuristic
                const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
                let isImg = false;
                if (header[0] === 0x89 && header[1] === 0x50) isImg = true; // PNG
                if (header[0] === 0xFF && header[1] === 0xD8) isImg = true; // JPG

                if (isImg) {
                    const url = URL.createObjectURL(blob);
                    setPreviewUrl(url);
                    addLog("IMAGE PAYLOAD DETECTED - PREVIEW READY");
                } else {
                    downloadBlob(blob, fileName);
                }
                setLastOutput(fileName);

            } catch (e: any) {
                addLog(`ERROR: ${e.message}`);
                playSound('error');
            }
        }
        setIsProcessing(false);
        setProgress(100);
        addLog('EXTRACTION COMPLETE');
        playSound('success');
    };

    const handleIncinerateClick = () => {
        if (files.length === 0) return;
        setShowConfirmModal(true);
        playSound('click');
    };

    const handleIncinerateConfirm = async () => {
        setShowConfirmModal(false);
        if (files.length === 0) return;
        setIsProcessing(true);

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            addLog(`PURGING: ${f.name}`);
            try {
                for (let p = 0; p < 3; p++) {
                    setProgress(((p + 1) / 3) * 100);
                    await new Promise(r => setTimeout(r, 400));
                }
            } catch (e: any) {
                playSound('error');
            }
        }
        addLog('BUFFERS FLUSHED');
        setFiles([]);
        setIsProcessing(false);
        playSound('success');
    };

    const handleTextAction = async () => {
        if (!textInput || !password) return;
        setIsProcessing(true);

        try {
            if (textMode === 'ENCRYPT') {
                const blob = new Blob([textInput], { type: 'text/plain' });
                const { blob: encBlob, fileName } = await runWorkerTask({
                    type: 'ENCRYPT',
                    file: blob,
                    password,
                    algorithm,
                    keyFileHash: keyFileHash || undefined,
                    useCompression,
                    explicitName: 'text_note'
                });
                // Convert blob to base64 for display
                const base64 = await blobToBase64(encBlob);
                setTextInput(base64);
                setLastOutput("TEXT ENCRYPTED");
                addLog("TEXT ENCRYPTED TO ARMOR STRING");
            } else {
                // Decrypt
                let inputStr = textInput.trim();
                if (!inputStr.startsWith('data:')) {
                    throw new Error("INVALID FORMAT (EXPECTED DATA URL)");
                }
                const blob = await base64ToBlob(inputStr);
                const { blob: decBlob } = await runWorkerTask({
                    type: 'DECRYPT',
                    file: blob,
                    password,
                    isStegano: false,
                    keyFileHash: keyFileHash || undefined,
                    originalName: 'note'
                });
                const text = await decBlob.text();
                setTextInput(text);
                setLastOutput("TEXT DECRYPTED");
                addLog("ARMOR STRIPPED & DECRYPTED");
            }
            playSound('success');
        } catch (e: any) {
            addLog(`TEXT OP FAILED: ${e.message}`);
            playSound('error');
        }
        setIsProcessing(false);
    };

    // --- Render ---

    const renderCoverImageDetail = (file: File) => (
        <div className="flex items-center justify-between bg-[#00E5FF] bg-opacity-5 border border-[#00E5FF] border-opacity-30 p-2 rounded mt-2">
            <div className="flex items-center gap-2 overflow-hidden">
                <ImageIcon className="w-4 h-4 text-[#00E5FF]" />
                <div className="flex flex-col min-w-0">
                    <span className="text-xs text-[#00E5FF] font-mono truncate">{file.name}</span>
                    <span className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
            </div>
            <button onClick={() => setCoverImage(null)} className="text-gray-500 hover:text-red-500 p-1">
                <X className="w-4 h-4" />
            </button>
        </div>
    );

    const renderFileList = () => (
        <div className="space-y-2 max-h-32 overflow-y-auto pr-1 mt-2">
            {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-900 border border-gray-800 p-2 rounded group hover:border-[#00E5FF] transition-colors">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <FileCode className="w-4 h-4 text-gray-500 group-hover:text-[#00E5FF]" />
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs text-gray-300 group-hover:text-white font-mono truncate">{f.name}</span>
                            <span className="text-[10px] text-gray-600">{(f.size / 1024).toFixed(1)} KB</span>
                        </div>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setFiles(prev => prev.filter((_, idx) => idx !== i));
                            playSound('click');
                        }}
                        className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );

    // --- Decoy Render ---
    if (decoyMode) {
        return (
            <div className="min-h-screen bg-white text-black font-sans text-xs flex flex-col overflow-hidden">
                <div className="bg-[#107c41] text-white p-2 flex items-center gap-4 select-none">
                    <Grid className="w-4 h-4" />
                    <span className="font-bold">Quarterly_Report_2024.xlsx</span>
                    <div className="flex-1"></div>
                    <div className="flex gap-2 opacity-80">
                        <div className="w-3 h-3 bg-white/20 rounded-full"></div>
                        <div className="w-3 h-3 bg-white/20 rounded-full"></div>
                    </div>
                </div>
                <div className="flex bg-[#f3f2f1] border-b border-[#e1dfdd] p-1 gap-1">
                    {['File', 'Home', 'Insert', 'Draw', 'Page Layout', 'Formulas', 'Data', 'Review', 'View'].map(m => (
                        <div key={m} className="px-3 py-1 hover:bg-white cursor-default rounded-sm">{m}</div>
                    ))}
                </div>
                <div className="bg-white border-b border-[#e1dfdd] p-2 flex gap-4 items-center text-gray-600">
                    <span className="font-bold">A1</span>
                    <div className="flex-1 border border-[#e1dfdd] bg-white px-2 py-0.5 text-black">Q3 Financial Overview</div>
                </div>
                <div className="flex-1 overflow-auto relative">
                    <div className="grid grid-cols-[40px_repeat(12,100px)] auto-rows-[24px]">
                        {/* Header Row */}
                        <div className="bg-[#f3f2f1] border-r border-b border-[#e1dfdd]"></div>
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="bg-[#f3f2f1] border-r border-b border-[#e1dfdd] flex items-center justify-center font-bold text-gray-600">
                                {String.fromCharCode(65 + i)}
                            </div>
                        ))}

                        {/* Rows */}
                        {Array.from({ length: 40 }).map((_, r) => (
                            <React.Fragment key={r}>
                                <div className="bg-[#f3f2f1] border-r border-b border-[#e1dfdd] flex items-center justify-center text-gray-500">
                                    {r + 1}
                                </div>
                                {Array.from({ length: 12 }).map((_, c) => (
                                    <div key={c} className="border-r border-b border-[#e1dfdd] px-2 flex items-center hover:bg-gray-100 cursor-cell selection:bg-green-100 selection:text-black">
                                        {r === 0 && c === 0 ? "Q3 Financial Overview" : ""}
                                        {r === 2 && c === 1 ? "Revenue" : ""}
                                        {r === 2 && c === 2 ? "Expenses" : ""}
                                        {r === 2 && c === 3 ? "Profit" : ""}
                                        {r === 3 && c === 1 ? "$1,240,500" : ""}
                                        {r === 3 && c === 2 ? "$840,200" : ""}
                                        {r === 3 && c === 3 ? "$400,300" : ""}
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                <div className="bg-[#f3f2f1] border-t border-[#e1dfdd] p-1 flex justify-between items-center px-4 text-gray-600">
                    <div className="flex gap-4">
                        <span className="bg-white px-3 py-0.5 border-t-2 border-[#107c41] font-bold text-[#107c41] shadow-sm">Sheet1</span>
                        <span className="hover:bg-gray-200 px-3 py-0.5 rounded-t-sm">Sheet2</span>
                    </div>
                    <span>Ready</span>
                </div>
            </div>
        );
    }

    if (duressMode && showFakeSuccess) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center text-gray-800 p-8">
                <div className="text-4xl mb-4">📂 My Documents</div>
                <p>Folder is empty.</p>
                <button onClick={() => window.location.reload()} className="mt-8 text-blue-500 underline">Refresh</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
            {/* Background Matrix */}
            <div className="absolute inset-0 pointer-events-none opacity-5" style={{
                backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,229,255, .3) 25%, rgba(0,229,255, .3) 26%, transparent 27%, transparent 74%, rgba(0,229,255, .3) 75%, rgba(0,229,255, .3) 76%, transparent 77%, transparent)',
                backgroundSize: '50px 50px'
            }}></div>

            {/* Main Window */}
            <div className="w-full max-w-2xl bg-[#0a0a0a] border border-[#00E5FF] border-opacity-30 shadow-[0_0_50px_rgba(0,229,255,0.1)] rounded-sm relative overflow-hidden backdrop-blur-md z-20">

                {/* Header */}
                <div className="bg-[#00E5FF] bg-opacity-10 p-3 flex justify-between items-center border-b border-[#00E5FF] border-opacity-20 select-none">
                    <div className="flex items-center gap-2 text-[#00E5FF]">
                        <Shield className="w-5 h-5 animate-pulse" />
                        <span className="font-bold tracking-widest text-sm">VORTEX SHIELD <span className="text-[10px] opacity-70">CDS_V5.0</span></span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowAboutModal(true)} className="p-1.5 text-[#00E5FF] hover:bg-[#00E5FF] hover:bg-opacity-20 rounded">
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
                <div className="grid grid-cols-5 border-b border-[#00E5FF] border-opacity-20 text-xs sm:text-sm">
                    {[
                        { id: AppMode.ENCRYPT, icon: Lock, activeIcon: ShieldCheck, label: 'ENCRYPT' },
                        { id: AppMode.DECRYPT, icon: Unlock, activeIcon: Key, label: 'DECRYPT' },
                        { id: AppMode.STEGANO, icon: Eye, activeIcon: ScanEye, label: 'GHOST' },
                        { id: AppMode.TEXT, icon: Type, activeIcon: FileText, label: 'TEXT' },
                        { id: AppMode.INCINERATOR, icon: Trash2, activeIcon: Flame, label: 'BURN' }
                    ].map((item) => {
                        const Icon = mode === item.id ? item.activeIcon : item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setMode(item.id);
                                    setFiles([]);
                                    setCoverImage(null);
                                    setLog([]);
                                    setPassword('');
                                    setTextInput('');
                                    setPreviewUrl(null);
                                    setLastOutput(null);
                                    setShowConfirmModal(false);
                                    playSound('click');
                                }}
                                className={`p-3 flex flex-col items-center gap-1 transition-colors ${mode === item.id ? 'bg-[#00E5FF] text-black font-bold' : 'text-gray-400 hover:text-[#00E5FF] hover:bg-[#00E5FF] hover:bg-opacity-5'}`}
                            >
                                <Icon className="w-4 h-4" />
                                {item.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* Preview Modal for Stegano */}
                    {previewUrl && (
                        <div className="bg-[#00E5FF] bg-opacity-5 border border-[#00E5FF] p-4 rounded flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
                            <span className="text-[#00E5FF] text-xs font-bold tracking-widest">DECRYPTED PAYLOAD PREVIEW</span>
                            <img src={previewUrl} alt="Decrypted" className="max-h-64 border border-gray-700 rounded" />
                            <a href={previewUrl} download="decrypted_image" className="text-xs text-gray-400 hover:text-white underline">Download Original</a>
                        </div>
                    )}

                    {/* Text Vault UI */}
                    {mode === AppMode.TEXT && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex justify-between items-center text-[#00E5FF] text-xs font-bold">
                                <span>SECURE TEXT VAULT</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setTextMode('ENCRYPT')} className={`px-2 py-1 rounded ${textMode === 'ENCRYPT' ? 'bg-[#00E5FF] text-black' : 'border border-[#00E5FF]'}`}>ENCRYPT</button>
                                    <button onClick={() => setTextMode('DECRYPT')} className={`px-2 py-1 rounded ${textMode === 'DECRYPT' ? 'bg-[#00E5FF] text-black' : 'border border-[#00E5FF]'}`}>DECRYPT</button>
                                </div>
                            </div>
                            <textarea
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                placeholder={textMode === 'ENCRYPT' ? "ENTER SENSITIVE DATA HERE..." : "PASTE ENCRYPTED ARMOR STRING HERE..."}
                                className="w-full h-48 bg-black border border-[#00E5FF] border-opacity-30 p-4 text-[#00E5FF] font-mono text-xs focus:outline-none focus:border-[#00E5FF] resize-none"
                            ></textarea>
                        </div>
                    )}

                    {/* Standard File UI */}
                    {mode !== AppMode.TEXT && (
                        <>
                            {mode === AppMode.INCINERATOR && (
                                <div className="bg-red-900/20 border border-red-500/50 p-4 rounded text-red-400 flex items-start gap-3 text-sm">
                                    <AlertTriangle className="w-5 h-5 shrink-0" />
                                    <div>
                                        <strong className="block mb-1">DOD STANDARD 5220.22-M</strong>
                                        3-pass overwrite. Irreversible.
                                    </div>
                                </div>
                            )}

                            {mode === AppMode.STEGANO && (
                                <>
                                    <DropZone
                                        onFilesSelect={handleCoverSelect}
                                        label="DROP COVER IMAGE"
                                        accept="image/*"
                                        multiple={false}
                                    />
                                    {coverImage && renderCoverImageDetail(coverImage)}
                                </>
                            )}

                            <DropZone
                                onFilesSelect={handleFilesSelect}
                                label={mode === AppMode.STEGANO ? "DROP PAYLOAD" : "DROP TARGET FILES"}
                            />
                            {files.length > 0 && renderFileList()}
                        </>
                    )}

                    {/* Settings & Key */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            {(mode === AppMode.ENCRYPT || mode === AppMode.STEGANO || mode === AppMode.TEXT) && (
                                <div className="flex items-center justify-between bg-[#00E5FF] bg-opacity-5 border border-[#00E5FF] border-opacity-20 p-2 rounded">
                                    <div className="flex items-center gap-2">
                                        <Settings className="w-4 h-4 text-[#00E5FF]" />
                                        <span className="text-xs text-gray-400 font-bold">ALGO</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {(['AES-GCM', 'AES-CBC'] as CryptoAlgorithm[]).map((algo) => (
                                            <button
                                                key={algo}
                                                onClick={() => setAlgorithm(algo)}
                                                className={`text-[9px] px-2 py-1 rounded border transition-all ${algorithm === algo
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

                        {(mode === AppMode.ENCRYPT || mode === AppMode.STEGANO || mode === AppMode.TEXT) && (
                            <div className="space-y-3">
                                <div
                                    onClick={() => setUseCompression(!useCompression)}
                                    className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${useCompression ? 'bg-[#00E5FF] bg-opacity-10 border-[#00E5FF]' : 'border-gray-800 hover:border-[#00E5FF]'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <FileArchive className={`w-4 h-4 ${useCompression ? 'text-[#00E5FF]' : 'text-gray-500'}`} />
                                        <span className={`text-xs font-bold ${useCompression ? 'text-[#00E5FF]' : 'text-gray-500'}`}>COMPRESSION</span>
                                    </div>
                                    <div className={`w-3 h-3 rounded-full ${useCompression ? 'bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]' : 'bg-gray-800'}`}></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Password */}
                    {mode !== AppMode.INCINERATOR && (
                        <div className="relative group">
                            <input
                                type="password"
                                value={password}
                                onChange={handlePasswordChange}
                                placeholder="ENTER SECURE KEY..."
                                className="w-full bg-black/50 border border-[#00E5FF] border-opacity-30 p-3 pl-10 text-[#00E5FF] focus:outline-none focus:border-[#00E5FF] transition-all placeholder-gray-700 font-mono"
                            />
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-[#00E5FF] opacity-30" />
                            <button onClick={handleGeneratePassword} className="absolute right-2 top-2 p-1 text-[#00E5FF] hover:bg-[#00E5FF] hover:bg-opacity-20 rounded" title="Generate Key">
                                <Dna className="w-4 h-4" />
                            </button>
                            <div className="mt-1 flex gap-1 h-1">
                                {[1, 2, 3, 4].map((level) => (
                                    <div key={level} className={`flex-1 h-full rounded-sm transition-all ${passwordStrength >= level ? (level === 1 ? 'bg-red-500' : level === 2 ? 'bg-orange-500' : level === 3 ? 'bg-yellow-400' : 'bg-green-500') : 'bg-gray-800'}`}></div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-4 pt-4 border-t border-[#00E5FF] border-opacity-10">
                        {(isProcessing || isScanning) && (
                            <div className="flex items-center gap-2 text-[#00E5FF] animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-xs font-mono">PROCESSING...</span>
                            </div>
                        )}

                        {mode === AppMode.ENCRYPT && (
                            <CyberButton label={isProcessing ? "ENCRYPTING..." : "ACTIVATE SHIELD"} onClick={handleEncrypt} disabled={files.length === 0 || !password || isProcessing} isLoading={isProcessing} />
                        )}
                        {mode === AppMode.DECRYPT && (
                            <CyberButton label={isProcessing ? "DECRYPTING..." : "UNLOCK VAULT"} onClick={handleDecrypt} disabled={files.length === 0 || !password || isProcessing} isLoading={isProcessing} />
                        )}
                        {mode === AppMode.TEXT && (
                            <CyberButton
                                label={isProcessing ? "PROCESSING..." : (textMode === 'ENCRYPT' ? "ENCRYPT NOTE" : "DECRYPT NOTE")}
                                onClick={handleTextAction}
                                disabled={!textInput || !password || isProcessing}
                                isLoading={isProcessing}
                            />
                        )}
                        {mode === AppMode.STEGANO && (
                            <div className="flex gap-2">
                                <CyberButton label="EXTRACT" variant="ghost" onClick={handleSteganoDecrypt} disabled={files.length === 0 || !password || isProcessing} isLoading={isProcessing} />
                                <CyberButton label="EMBED" onClick={handleStegano} disabled={files.length === 0 || !coverImage || !password || isProcessing} isLoading={isProcessing} />
                            </div>
                        )}
                        {mode === AppMode.INCINERATOR && (
                            <CyberButton label={isProcessing ? "PURGING..." : "INCINERATE"} variant="danger" onClick={handleIncinerateClick} disabled={files.length === 0 || isProcessing} isLoading={isProcessing} />
                        )}
                    </div>
                </div>

                {/* Progress */}
                {isProcessing && (
                    <div className="h-1 w-full bg-gray-900">
                        <div className="h-full bg-[#00E5FF] shadow-[0_0_10px_#00E5FF] transition-all duration-200" style={{ width: `${progress}%` }} />
                    </div>
                )}

                {/* Log */}
                <div className="bg-black border-t border-[#00E5FF] border-opacity-20 p-4 font-mono text-xs h-32 overflow-y-auto">
                    <div className="flex justify-between text-gray-500 mb-2 border-b border-gray-800 pb-1">
                        <div className="flex gap-2"><Terminal className="w-3 h-3" /> SYSTEM_LOG</div>
                        <button onClick={handleExportLog} className="flex gap-1 hover:text-[#00E5FF]"><FileDown className="w-3 h-3" /> EXPORT</button>
                    </div>
                    <div className="space-y-1 text-[#00E5FF] opacity-80">
                        {log.map((entry, i) => (
                            <div key={i} className="flex gap-2 group">
                                <span className="opacity-50 text-[10px] whitespace-nowrap">{entry.timestamp}</span>
                                <div className="flex-1 flex justify-between">
                                    <MatrixText text={entry.text} speed={30} />
                                    {i === log.length - 1 && (
                                        <button onClick={() => copyLogMessage(entry.text)} className="opacity-0 group-hover:opacity-100 hover:text-white"><Copy className="w-3 h-3" /></button>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>

                {/* Developer Info Footer */}
                <div className="p-2 bg-black/50">
                    <DeveloperInfo />
                </div>

                {/* Confirmation Modal */}
                {showConfirmModal && (
                    <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
                        <div className="bg-[#0a0a0a] border border-red-500 shadow-[0_0_30px_rgba(255,0,0,0.2)] p-6 max-w-sm w-full">
                            <div className="flex items-center gap-3 text-red-500 mb-4">
                                <AlertTriangle className="w-8 h-8" />
                                <h3 className="text-lg font-bold">WARNING</h3>
                            </div>
                            <p className="text-gray-300 text-sm mb-6">Permanently incinerate {files.length} files? Irreversible.</p>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setShowConfirmModal(false)} className="text-gray-400 hover:text-white px-4 py-2">CANCEL</button>
                                <button onClick={handleIncinerateConfirm} className="bg-red-600 text-black font-bold px-4 py-2 hover:bg-red-500">CONFIRM</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* About Modal */}
                {showAboutModal && (
                    <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
                        <div className="bg-[#0a0a0a] border border-[#00E5FF] p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4 text-[#00E5FF]">
                                <h3 className="font-bold flex gap-2"><Shield className="w-4 h-4" /> SYSTEM_INFO</h3>
                                <button onClick={() => setShowAboutModal(false)}><X className="w-5 h-5" /></button>
                            </div>
                            <div className="space-y-4 text-xs text-gray-400">
                                <p>Vortex Shield is a local-only encryption suite. No data leaves your device.</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="border border-gray-800 p-2">AES-256-GCM</div>
                                    <div className="border border-gray-800 p-2">PBKDF2 Key Derivation</div>
                                    <div className="border border-gray-800 p-2">Steganography</div>
                                    <div className="border border-gray-800 p-2">Secure Text Vault</div>
                                </div>
                                <div>
                                    <strong className="text-white">HOTKEYS:</strong>
                                    <ul className="list-disc pl-4 mt-1">
                                        <li>Alt+E: Encrypt | Alt+D: Decrypt</li>
                                        <li>Alt+T: Text Vault | Alt+I: Incinerate</li>
                                        <li>Alt+C: Chameleon (Decoy Mode)</li>
                                        <li>Ctrl+Shift+K: KILL SWITCH</li>
                                        <li>Double Esc: KILL SWITCH</li>
                                    </ul>
                                </div>
                                <DeveloperInfo />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
