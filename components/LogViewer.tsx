import React, { useRef, useEffect } from 'react';
import { Terminal, FileDown, Copy } from 'lucide-react';
import MatrixText from './MatrixText';

export interface LogEntry {
    text: string;
    timestamp: string;
}

interface LogViewerProps {
    log: LogEntry[];
    onExport: () => void;
    onCopy: (text: string) => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ log, onExport, onCopy }) => {
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [log]);

    return (
        <div className="bg-black border-t border-[#00E5FF] border-opacity-20 p-4 font-mono text-xs h-32 overflow-y-auto">
            <div className="flex justify-between text-gray-500 mb-2 border-b border-gray-800 pb-1">
                <div className="flex gap-2"><Terminal className="w-3 h-3" /> SYSTEM_LOG</div>
                <button onClick={onExport} className="flex gap-1 hover:text-[#00E5FF]"><FileDown className="w-3 h-3" /> EXPORT</button>
            </div>
            <div className="space-y-1 text-[#00E5FF] opacity-80">
                {log.map((entry, i) => (
                    <div key={i} className="flex gap-2 group">
                        <span className="opacity-50 text-[10px] whitespace-nowrap">{entry.timestamp}</span>
                        <div className="flex-1 flex justify-between">
                            <MatrixText text={entry.text} speed={30} />
                            {i === log.length - 1 && (
                                <button onClick={() => onCopy(entry.text)} className="opacity-0 group-hover:opacity-100 hover:text-white"><Copy className="w-3 h-3" /></button>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={logEndRef} />
            </div>
        </div>
    );
};

export default LogViewer;
