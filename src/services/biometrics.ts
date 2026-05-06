export const isBiometricSupported = async (): Promise<boolean> => {
  if (!window.PublicKeyCredential) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    return false;
  }
};

const bufferToBase64url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  const base64String = btoa(str);
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const base64urlToBuffer = (base64url: string): ArrayBuffer => {
  const padding = '='.repeat((4 - base64url.length % 4) % 4);
  const base64 = (base64url + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
};

export const registerBiometric = async (masterKey: string): Promise<void> => {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  
  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(userId);

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: "RootVault",
        id: window.location.hostname
      },
      user: {
        id: userId,
        name: "user@rootvault",
        displayName: "RootVault User"
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required"
      },
      timeout: 60000
    }
  }) as PublicKeyCredential;

  if (credential) {
    const rawId = bufferToBase64url(credential.rawId);
    
    const bioData = {
      rawId,
      // In a real backend architecture, we'd never store the master key locally in plain text.
      // Without WebAuthn PRF extension or a backend KMS, local storage gating is used for client-only SPAs.
      key: btoa(masterKey) // Obfuscate slightly 
    };
    localStorage.setItem('rootvault_bio_data', JSON.stringify(bioData));
  }
};

export const verifyBiometric = async (): Promise<string | null> => {
  const bioDataStr = localStorage.getItem('rootvault_bio_data');
  if (!bioDataStr) return null;
  const bioData = JSON.parse(bioDataStr);

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{
        type: "public-key",
        id: base64urlToBuffer(bioData.rawId)
      }],
      userVerification: "required",
      timeout: 60000
    }
  });

  if (assertion) {
    return atob(bioData.key);
  }
  return null;
};

export const clearBiometric = () => {
  localStorage.removeItem('rootvault_bio_data');
};
