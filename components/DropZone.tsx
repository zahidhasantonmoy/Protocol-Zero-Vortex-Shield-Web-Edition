import React, { useRef, useState } from 'react';
import { Upload, File, FileLock } from 'lucide-react';
import { playSound } from '../utils/audio';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  label?: string;
  accept?: string;
  selectedFile?: File | null;
}

const DropZone: React.FC<DropZoneProps> = ({ onFileSelect, label = "DROP TARGET FILE OR CLICK TO SCAN", accept, selectedFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    playSound('success');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300
        flex flex-col items-center justify-center p-4 group overflow-hidden
        ${isDragging ? 'border-[#00E5FF] bg-[#00E5FF]/10 shadow-[0_0_20px_#00E5FF]' : 'border-gray-700 hover:border-[#00E5FF] hover:bg-gray-900'}
      `}
    >
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        onChange={(e) => e.target.files && onFileSelect(e.target.files[0])}
        accept={accept}
      />
      
      {selectedFile ? (
        <div className="text-center z-10 animate-pulse">
           <FileLock className="w-12 h-12 text-[#00E5FF] mx-auto mb-2" />
           <p className="text-[#00E5FF] font-bold text-lg break-all">{selectedFile.name}</p>
           <p className="text-gray-400 text-sm">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      ) : (
        <div className="text-center z-10">
          <Upload className={`w-12 h-12 mb-2 transition-colors ${isDragging ? 'text-[#00E5FF]' : 'text-gray-500 group-hover:text-[#00E5FF]'}`} />
          <p className={`font-bold tracking-widest transition-colors ${isDragging ? 'text-[#00E5FF]' : 'text-gray-500 group-hover:text-[#00E5FF]'}`}>
            {label}
          </p>
        </div>
      )}

      {/* Scanning Grid Background Effect */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(rgba(0,229,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
    </div>
  );
};

export default DropZone;