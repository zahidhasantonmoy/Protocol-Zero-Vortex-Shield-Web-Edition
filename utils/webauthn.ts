// Simple WebAuthn Helpers for "Bio-Lock" Session Guard

export const isWebAuthnAvailable = () => {
    return window.crypto && !!window.navigator.credentials && !!window.PublicKeyCredential;
};

// Generate a random challenge
const getChallenge = () => {
    return window.crypto.getRandomValues(new Uint8Array(32));
};

export const registerBioLock = async (username: string): Promise<boolean> => {
    if (!isWebAuthnAvailable()) throw new Error("WebAuthn not supported");

    try {
        const publicKey: PublicKeyCredentialCreationOptions = {
            challenge: getChallenge(),
            rp: {
                name: "Vortex Shield",
                id: window.location.hostname // Must match current domain
            },
            user: {
                id: window.crypto.getRandomValues(new Uint8Array(16)),
                name: username,
                displayName: username
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
            authenticatorSelection: {
                authenticatorAttachment: "platform", // TouchID / FaceID
                userVerification: "required"
            },
            timeout: 60000,
            attestation: "none"
        };

        const credential = await navigator.credentials.create({ publicKey });
        return !!credential;
    } catch (e) {
        console.error("Bio-Lock Registration Failed", e);
        return false;
    }
};

export const authenticateBioLock = async (): Promise<boolean> => {
    if (!isWebAuthnAvailable()) throw new Error("WebAuthn not supported");

    try {
        const publicKey: PublicKeyCredentialRequestOptions = {
            challenge: getChallenge(),
            userVerification: "required",
            timeout: 60000
        };

        const assertion = await navigator.credentials.get({ publicKey });
        return !!assertion;
    } catch (e) {
        console.error("Bio-Lock Auth Failed", e);
        return false;
    }
};
