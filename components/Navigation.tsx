import React from 'react';
import { Lock, Unlock, Eye, Trash2, FileText, ShieldCheck, Key, ScanEye, Flame } from 'lucide-react';

export enum AppMode {
    ENCRYPT = 'ENCRYPT',
    DECRYPT = 'DECRYPT',
    STEGANO = 'STEGANO',
    INCINERATOR = 'INCINERATOR',
    TEXT = 'TEXT_VAULT'
}

interface NavigationProps {
    mode: AppMode;
    setMode: (mode: AppMode) => void;
    onModeChange: () => void;
    tc: any; // Theme context
}

const Navigation: React.FC<NavigationProps> = ({ mode, setMode, onModeChange, tc }) => {
    const navItems = [
        { id: AppMode.ENCRYPT, icon: Lock, activeIcon: ShieldCheck, label: 'ENCRYPT' },
        { id: AppMode.DECRYPT, icon: Unlock, activeIcon: Key, label: 'DECRYPT' },
        { id: AppMode.STEGANO, icon: Eye, activeIcon: ScanEye, label: 'GHOST' },
        { id: AppMode.TEXT, icon: FileText, activeIcon: FileText, label: 'TEXT' },
        { id: AppMode.INCINERATOR, icon: Trash2, activeIcon: Flame, label: 'BURN' }
    ];

    return (
        <div className={`grid grid-cols-5 border-b ${tc.border} border-opacity-20 text-xs sm:text-sm`}>
            {navItems.map((item) => {
                const Icon = mode === item.id ? item.activeIcon : item.icon;
                return (
                    <button
                        key={item.id}
                        onClick={() => {
                            setMode(item.id);
                            onModeChange();
                        }}
                        className={`p-3 flex flex-col items-center gap-1 transition-colors ${mode === item.id ? `${tc.bgOp} ${tc.text} font-bold` : `text-gray-400 hover:${tc.text} hover:${tc.bgOp}`}`}
                    >
                        <Icon className="w-4 h-4" />
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
};

export default Navigation;
