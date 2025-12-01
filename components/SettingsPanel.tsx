import React from 'react';
import { Settings, FileArchive, Briefcase } from 'lucide-react';
import { CryptoAlgorithm } from '../utils/crypto';

interface SettingsPanelProps {
    mode: string;
    algorithm: CryptoAlgorithm;
    setAlgorithm: (algo: CryptoAlgorithm) => void;
    useCompression: boolean;
    setUseCompression: (use: boolean) => void;
    autoLockDuration: number;
    setAutoLockDuration: (duration: number) => void;
    tc: any; // Theme context
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
    mode,
    algorithm,
    setAlgorithm,
    useCompression,
    setUseCompression,
    autoLockDuration,
    setAutoLockDuration,
    tc
}) => {
    // Only show settings in relevant modes
    if (mode === 'INCINERATOR' || mode === 'DECRYPT') return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
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
                                    ? `${tc.bgOp} ${tc.text} ${tc.border} font-bold`
                                    : `border-gray-700 text-gray-500 hover:${tc.border}`
                                    }`}
                            >
                                {algo}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <div
                    onClick={() => setUseCompression(!useCompression)}
                    className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${useCompression ? `${tc.bgOp} ${tc.border}` : `border-gray-800 hover:${tc.border}`}`}
                >
                    <div className="flex items-center gap-2">
                        <FileArchive className={`w-4 h-4 ${useCompression ? tc.text : 'text-gray-500'}`} />
                        <span className={`text-xs font-bold ${useCompression ? tc.text : 'text-gray-500'}`}>COMPRESSION</span>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${useCompression ? `${tc.bg} shadow-[0_0_8px_${tc.accent}]` : 'bg-gray-800'}`} style={useCompression ? { backgroundColor: tc.accent } : {}}></div>
                </div>

                <div className="flex items-center justify-between bg-[#00E5FF] bg-opacity-5 border border-[#00E5FF] border-opacity-20 p-2 rounded">
                    <span className="text-xs text-gray-400 font-bold">AUTO-LOCK</span>
                    <select
                        value={autoLockDuration}
                        onChange={(e) => setAutoLockDuration(Number(e.target.value))}
                        className={`bg-black border ${tc.border} text-[9px] px-1 py-0.5 rounded ${tc.text} focus:outline-none`}
                    >
                        <option value={60000}>1 MIN</option>
                        <option value={300000}>5 MIN</option>
                        <option value={1800000}>30 MIN</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
