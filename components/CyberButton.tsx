import React from 'react';
import { playSound } from '../utils/audio';

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost';
  label: string;
}

const CyberButton: React.FC<CyberButtonProps> = ({ variant = 'primary', label, className, onClick, disabled, ...props }) => {
  const baseStyles = "relative px-6 py-3 font-bold uppercase transition-all duration-100 transform clip-path-polygon focus:outline-none";
  
  const variants = {
    primary: "bg-[#00E5FF] text-black hover:bg-white hover:shadow-[0_0_15px_#00E5FF]",
    danger: "bg-red-600 text-black hover:bg-red-500 hover:shadow-[0_0_15px_#FF0000]",
    ghost: "bg-transparent border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black",
  };

  const disabledStyle = "opacity-50 cursor-not-allowed filter grayscale";

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${disabled ? disabledStyle : ''} ${className}`}
      onMouseEnter={() => !disabled && playSound('hover')}
      onClick={(e) => {
        if (!disabled) {
          playSound('click');
          if (onClick) onClick(e);
        }
      }}
      disabled={disabled}
      {...props}
    >
      <span className="relative z-10 tracking-wider">{label}</span>
      {/* Decorative corner accents */}
      {!disabled && (
        <>
          <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white opacity-50"></span>
          <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white opacity-50"></span>
        </>
      )}
    </button>
  );
};

export default CyberButton;