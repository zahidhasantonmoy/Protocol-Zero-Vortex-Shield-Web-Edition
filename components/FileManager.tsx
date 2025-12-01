import React from 'react';
import { FileCode, X, Image as ImageIcon } from 'lucide-react';
import DropZone from './DropZone';
import { formatFileSize } from '../utils/formatting';

interface FileManagerProps {
    files: File[];
    onFilesSelect: (files: File[]) => void;
    onRemoveFile: (index: number) => void;
    coverImage: File | null;
    onCoverSelect: (files: File[]) => void;
    onRemoveCover: () => void;
    mode: string;
    tc: any; // Theme context
}

const FileManager: React.FC<FileManagerProps> = ({
    files,
    onFilesSelect,
    onRemoveFile,
    coverImage,
    onCoverSelect,
    onRemoveCover,
    mode,
    tc
}) => {
    const renderCoverImageDetail = (file: File) => (
        <div className={`flex items-center justify-between ${tc.bgOp} border ${tc.border} border-opacity-30 p-2 rounded mt-2`}>
            <div className="flex items-center gap-2 overflow-hidden">
                <ImageIcon className={`w-4 h-4 ${tc.text}`} />
                <div className="flex flex-col min-w-0">
                    <span className={`text-xs ${tc.text} font-mono truncate`}>{file.name}</span>
                    <span className="text-[10px] text-gray-500">{formatFileSize(file.size)}</span>
                </div>
            </div>
            <button onClick={onRemoveCover} className="text-gray-500 hover:text-red-500 p-1">
                <X className="w-4 h-4" />
            </button>
        </div>
    );

    const renderFileList = () => (
        <div className="space-y-2 max-h-32 overflow-y-auto pr-1 mt-2">
            {files.map((f, i) => (
                <div key={i} className={`flex items-center justify-between bg-gray-900 border border-gray-800 p-2 rounded group hover:${tc.border} transition-colors`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        <FileCode className={`w-4 h-4 text-gray-500 group-hover:${tc.text}`} />
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs text-gray-300 group-hover:text-white font-mono truncate">{f.name}</span>
                            <span className="text-[10px] text-gray-600">{formatFileSize(f.size)}</span>
                        </div>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFile(i);
                        }}
                        className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );

    if (mode === 'TEXT_VAULT') return null;

    return (
        <>
            {mode === 'STEGANO' && (
                <>
                    <DropZone
                        onFilesSelect={onCoverSelect}
                        label="DROP COVER IMAGE"
                        accept="image/*"
                        multiple={false}
                    />
                    {coverImage && renderCoverImageDetail(coverImage)}
                </>
            )}

            <DropZone
                onFilesSelect={onFilesSelect}
                label={mode === 'STEGANO' ? "DROP PAYLOAD" : "DROP TARGET FILES"}
            />
            {files.length > 0 && renderFileList()}
        </>
    );
};

export default FileManager;
