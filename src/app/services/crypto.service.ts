import { Injectable } from '@angular/core';

const ITERATIONS = 480_000;
const CANARY = 'pwapp-canary-v1';
const SALT_LENGTH = 32;
const IV_LENGTH = 12;

@Injectable({ providedIn: 'root' })
export class CryptoService {

  generateSalt(): Uint8Array {
    const buf = new Uint8Array(new ArrayBuffer(SALT_LENGTH));
    crypto.getRandomValues(buf);
    return buf;
  }

  async deriveKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(masterPassword),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(plaintext: string, key: CryptoKey): Promise<string> {
    if (!plaintext) return plaintext;
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    const combined = new Uint8Array(IV_LENGTH + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), IV_LENGTH);
    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(token: string, key: CryptoKey): Promise<string> {
    if (!token) return token;
    const combined = Uint8Array.from(atob(token), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  }

  async makeCanary(key: CryptoKey): Promise<string> {
    return this.encrypt(CANARY, key);
  }

  async checkCanary(canaryToken: string, key: CryptoKey): Promise<boolean> {
    try {
      const decrypted = await this.decrypt(canaryToken, key);
      return decrypted === CANARY;
    } catch {
      return false;
    }
  }

  saltToBase64(salt: Uint8Array): string {
    return btoa(String.fromCharCode(...salt));
  }

  base64ToSalt(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }
}
