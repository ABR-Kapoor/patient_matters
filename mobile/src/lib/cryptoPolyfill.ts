import CryptoJS from 'crypto-js';

// Safe property definer that never throws if a global property is non-writable / getter-only (e.g. Hermes globalThis.expo)
function safeDefine(target: any, prop: string, value: any): void {
  if (!target) return;
  try {
    if (target[prop] !== undefined) return;
    target[prop] = value;
  } catch {
    try {
      Object.defineProperty(target, prop, {
        value,
        configurable: true,
        writable: true,
      });
    } catch {
      // Ignored if completely sealed
    }
  }
}

const g = globalThis as any;

// 1. Safe crypto getRandomValues & randomUUID polyfill
const cryptoFallback = {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T {
    if (!array) return array;
    const uint8 = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < uint8.length; i++) {
      uint8[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  randomUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },
};

if (!g.crypto) {
  safeDefine(g, 'crypto', cryptoFallback);
} else {
  if (typeof g.crypto.getRandomValues !== 'function') {
    safeDefine(g.crypto, 'getRandomValues', cryptoFallback.getRandomValues);
  }
  if (typeof g.crypto.randomUUID !== 'function') {
    safeDefine(g.crypto, 'randomUUID', cryptoFallback.randomUUID);
  }
}

// 2. Mock ExpoCrypto native module
const mockExpoCrypto = {
  async digestStringAsync(
    algorithm: string,
    data: string,
    options?: { encoding?: 'hex' | 'base64' }
  ): Promise<string> {
    const alg = (algorithm || '').toUpperCase().replace('-', '');
    let hash: any;
    if (alg === 'SHA1') hash = CryptoJS.SHA1(data);
    else if (alg === 'SHA384') hash = CryptoJS.SHA384(data);
    else if (alg === 'SHA512') hash = CryptoJS.SHA512(data);
    else hash = CryptoJS.SHA256(data);

    if (options?.encoding === 'hex') {
      return hash.toString(CryptoJS.enc.Hex);
    }
    return hash.toString(CryptoJS.enc.Base64);
  },

  getRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    if (typeof g.crypto?.getRandomValues === 'function') {
      g.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  },

  async getRandomBytesAsync(length: number): Promise<Uint8Array> {
    return this.getRandomBytes(length);
  },

  getRandomValues<T extends ArrayBufferView | null>(typedArray: T): T {
    if (typeof g.crypto?.getRandomValues === 'function') {
      return g.crypto.getRandomValues(typedArray);
    }
    return cryptoFallback.getRandomValues(typedArray);
  },

  randomUUID(): string {
    if (typeof g.crypto?.randomUUID === 'function') {
      return g.crypto.randomUUID();
    }
    return cryptoFallback.randomUUID();
  },

  async digestAsync(algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> {
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const hash = CryptoJS.SHA256(CryptoJS.enc.Latin1.parse(binary));
    const hex = hash.toString(CryptoJS.enc.Hex);
    const result = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      result[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return result.buffer;
  },
};

// 3. Register on globalThis.expo.modules
if (!g.expo) {
  safeDefine(g, 'expo', { modules: {} });
}
if (g.expo) {
  if (!g.expo.modules) {
    safeDefine(g.expo, 'modules', {});
  }
  if (g.expo.modules && !g.expo.modules.ExpoCrypto) {
    safeDefine(g.expo.modules, 'ExpoCrypto', mockExpoCrypto);
  }
  if (g.expo.modules && !g.expo.modules.ExpoNavigationBar) {
    safeDefine(g.expo.modules, 'ExpoNavigationBar', {
      setBackgroundColorAsync: async () => {},
      setButtonStyleAsync: async () => {},
      setVisibilityAsync: async () => {},
      setPositionAsync: async () => {},
      getBackgroundColorAsync: async () => '#000000',
      addListener: () => ({ remove: () => {} }),
      removeListeners: () => {},
    });
  }
}

// 4. Register on React Native NativeModules for TurboModuleRegistry fallback
try {
  const { NativeModules } = require('react-native');
  if (NativeModules && !NativeModules.ExpoCrypto) {
    safeDefine(NativeModules, 'ExpoCrypto', mockExpoCrypto);
  }
  if (NativeModules && !NativeModules.ExpoNavigationBar) {
    safeDefine(NativeModules, 'ExpoNavigationBar', {
      setBackgroundColorAsync: async () => {},
      setButtonStyleAsync: async () => {},
    });
  }
} catch {
  // Ignored if not in React Native environment
}
