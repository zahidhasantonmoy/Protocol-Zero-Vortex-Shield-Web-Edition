import React from 'react';
import { playSound } from '../utils/audio';
import { Loader2 } from 'lucide-react';

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost';
  label: string;
  isLoading?: boolean;
}

const CyberButton: React.FC<CyberButtonProps> = ({ variant = 'primary', label, className, onClick, disabled, isLoading, ...props }) => {
  const baseStyles = "relative px-6 py-3 font-bold uppercase transition-all duration-100 transform clip-path-polygon focus:outline-none flex items-center justify-center min-w-[140px]";
  
  const variants = {
    primary: "bg-[#00E5FF] text-black hover:bg-white hover:shadow-[0_0_15px_#00E5FF]",
    danger: "bg-red-600 text-black hover:bg-red-500 hover:shadow-[0_0_15px_#FF0000]",
    ghost: "bg-transparent border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black",
  };

  // Only apply strict disabled styles if strictly disabled and not loading
  const disabledStyle = "opacity-50 cursor-not-allowed filter grayscale";
  const loadingStyle = "cursor-wait opacity-90";

  const appliedStyle = disabled && !isLoading ? disabledStyle : isLoading ? loadingStyle : "";

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${appliedStyle} ${className}`}
      onMouseEnter={() => !disabled && !isLoading && playSound('hover')}
      onClick={(e) => {
        if (!disabled && !isLoading) {
          playSound('click');
          if (onClick) onClick(e);
        }
      }}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Decorative corner accents - hide when loading or disabled to reduce noise */}
      {!disabled && !isLoading && (
        <>
          <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white opacity-50"></span>
          <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white opacity-50"></span>
        </>
      )}

      <span className="relative z-10 tracking-wider flex items-center gap-2">
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {label}
      </span>
    </button>
  );
};

export default CyberButton;