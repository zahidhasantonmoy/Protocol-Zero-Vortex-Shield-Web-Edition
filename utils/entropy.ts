export interface EntropyResult {
    score: number; // 0-4
    bits: number;
    crackTime: string;
}

export const analyzeEntropy = (password: string): EntropyResult => {
    if (!password) return { score: 0, bits: 0, crackTime: 'Instant' };

    let poolSize = 0;
    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/[0-9]/.test(password)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

    const bits = Math.log2(Math.pow(poolSize, password.length));

    // Crack time estimation (assuming 10^12 guesses/sec for a powerful rig)
    const guessesPerSec = 1e12;
    const seconds = Math.pow(2, bits) / guessesPerSec;

    let crackTime = '';
    if (seconds < 1) crackTime = 'Instant';
    else if (seconds < 60) crackTime = `${Math.round(seconds)} seconds`;
    else if (seconds < 3600) crackTime = `${Math.round(seconds / 60)} minutes`;
    else if (seconds < 86400) crackTime = `${Math.round(seconds / 3600)} hours`;
    else if (seconds < 31536000) crackTime = `${Math.round(seconds / 86400)} days`;
    else if (seconds < 31536000 * 100) crackTime = `${Math.round(seconds / 31536000)} years`;
    else crackTime = 'Centuries';

    let score = 0;
    if (bits > 30) score = 1;
    if (bits > 50) score = 2;
    if (bits > 70) score = 3;
    if (bits > 90) score = 4;

    return { score, bits: Math.round(bits), crackTime };
};
