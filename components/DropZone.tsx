import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { playSound } from '../utils/audio';

interface DropZoneProps {
  onFilesSelect: (files: File[]) => void;
  label?: string;
  accept?: string;
  multiple?: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ onFilesSelect, label = "DROP TARGET FILES", accept, multiple = true }) => {
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (multiple) {
        onFilesSelect(Array.from(e.dataTransfer.files));
      } else {
        onFilesSelect([e.dataTransfer.files[0]]);
      }
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
        relative w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300
        flex flex-col items-center justify-center p-4 group overflow-hidden
        ${isDragging ? 'border-[#00E5FF] bg-[#00E5FF]/10 shadow-[0_0_20px_#00E5FF]' : 'border-gray-700 hover:border-[#00E5FF] hover:bg-gray-900'}
      `}
    >
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            if (multiple) {
              onFilesSelect(Array.from(e.target.files));
            } else {
              onFilesSelect([e.target.files[0]]);
            }
          }
        }}
        accept={accept}
        multiple={multiple}
      />
      
      <div className="text-center z-10">
        <Upload className={`w-8 h-8 mb-2 mx-auto transition-colors ${isDragging ? 'text-[#00E5FF]' : 'text-gray-500 group-hover:text-[#00E5FF]'}`} />
        <p className={`font-bold tracking-widest text-xs transition-colors ${isDragging ? 'text-[#00E5FF]' : 'text-gray-500 group-hover:text-[#00E5FF]'}`}>
          {label}
        </p>
        <p className="text-[10px] text-gray-600 mt-1">
            {multiple ? "BATCH PROCESSING ENABLED" : "SINGLE FILE ONLY"}
        </p>
      </div>

      {/* Scanning Grid Background Effect */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(rgba(0,229,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
    </div>
  );
};

export default DropZone;