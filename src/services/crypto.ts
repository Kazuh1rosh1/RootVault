import CryptoJS from 'crypto-js';

/**
 * RootVault Crypto Service
 * Uses PBKDF2 for key derivation and AES-256 for vault encryption.
 * Note: CryptoJS uses AES-CBC by default in some configurations, 
 * but we can use it to securely encrypt/decrypt strings.
 */

const SALT_KEY = 'rootvault_crypto_anchor';
const ITERATIONS = 100000;

export interface VaultEntry {
  id: string;
  service: string;
  username: string;
  password: string;
  notes?: string;
  category: string;
  updatedAt: number;
  isFavorite?: boolean;
}

export const deriveKey = (password: string): string => {
  return CryptoJS.PBKDF2(password, SALT_KEY, {
    keySize: 256 / 32,
    iterations: ITERATIONS
  }).toString();
};

export const encryptVault = (entries: VaultEntry[], key: string): string => {
  const data = JSON.stringify(entries);
  return CryptoJS.AES.encrypt(data, key).toString();
};

export const decryptVault = (encryptedData: string, key: string): VaultEntry[] => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedData) throw new Error('Invalid key');
    const parsed = JSON.parse(decryptedData);
    if (!Array.isArray(parsed)) throw new Error('Malformed vault data');
    return parsed;
  } catch (error) {
    throw new Error('Decryption failed. Check your master password.');
  }
};

export const generateId = (): string => {
  if (window?.crypto?.randomUUID) {
    try {
      return window.crypto.randomUUID();
    } catch(e) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const generatePassword = (length = 14, options = { numbers: true, symbols: true }): string => {
  const lettersUpper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lettersLower = "abcdefghijklmnopqrstuvwxyz";
  const numSet = "0123456789";
  const symSet = "!@#$%^&*()_+~`|}{[]:;?><,./-=";
  
  let all = lettersUpper + lettersLower;
  if (options.numbers) all += numSet;
  if (options.symbols) all += symSet;

  const getSecureRandom = () => {
    if (window?.crypto?.getRandomValues) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0] / (0xffffffff + 1);
    }
    return Math.random();
  };

  let retVal = "";
  // Ensure variety if options are enabled
  retVal += lettersUpper.charAt(Math.floor(getSecureRandom() * lettersUpper.length));
  retVal += lettersLower.charAt(Math.floor(getSecureRandom() * lettersLower.length));
  if (options.numbers) retVal += numSet.charAt(Math.floor(getSecureRandom() * numSet.length));
  if (options.symbols) retVal += symSet.charAt(Math.floor(getSecureRandom() * symSet.length));

  const currentLen = retVal.length;
  for (let i = currentLen; i < length; ++i) {
    retVal += all.charAt(Math.floor(getSecureRandom() * all.length));
  }
  
  // Shuffle result
  return retVal.split('').sort(() => 0.5 - getSecureRandom()).join('');
};
