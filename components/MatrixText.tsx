import React, { useState, useEffect } from 'react';

interface MatrixTextProps {
  text: string;
  speed?: number;
  className?: string;
}

const MatrixText: React.FC<MatrixTextProps> = ({ text, speed = 50, className }) => {
  const [display, setDisplay] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';

  useEffect(() => {
    let iteration = 0;
    let interval: any = null;

    clearInterval(interval);

    interval = setInterval(() => {
      setDisplay(
        text
          .split('')
          .map((letter, index) => {
            if (index < iteration) {
              return text[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );

      if (iteration >= text.length) {
        clearInterval(interval);
      }

      iteration += 1 / 3;
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return <span className={className}>{display}</span>;
};

export default MatrixText;