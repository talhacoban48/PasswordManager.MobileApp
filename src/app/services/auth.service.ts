import { Injectable } from '@angular/core';
import { CryptoService } from './crypto.service';

const AUTH_KEY = 'pwapp_auth';

interface AuthConfig {
  salt: string;
  canary: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _key: CryptoKey | null = null;

  constructor(private crypto: CryptoService) {}

  get key(): CryptoKey | null {
    return this._key;
  }

  isConfigured(): boolean {
    return localStorage.getItem(AUTH_KEY) !== null;
  }

  async setup(masterPassword: string): Promise<CryptoKey> {
    const salt = this.crypto.generateSalt();
    const key = await this.crypto.deriveKey(masterPassword, salt);
    const canary = await this.crypto.makeCanary(key);
    const config: AuthConfig = { salt: this.crypto.saltToBase64(salt), canary };
    localStorage.setItem(AUTH_KEY, JSON.stringify(config));
    this._key = key;
    return key;
  }

  async login(masterPassword: string): Promise<CryptoKey | null> {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const config: AuthConfig = JSON.parse(raw);
    const salt = this.crypto.base64ToSalt(config.salt);
    const key = await this.crypto.deriveKey(masterPassword, salt);
    const valid = await this.crypto.checkCanary(config.canary, key);
    if (valid) {
      this._key = key;
      return key;
    }
    return null;
  }

  async prepareNewKey(newPassword: string): Promise<{ key: CryptoKey; config: AuthConfig }> {
    const salt = this.crypto.generateSalt();
    const key = await this.crypto.deriveKey(newPassword, salt);
    const canary = await this.crypto.makeCanary(key);
    const config: AuthConfig = { salt: this.crypto.saltToBase64(salt), canary };
    return { key, config };
  }

  commitKey(config: AuthConfig, key: CryptoKey): void {
    localStorage.setItem(AUTH_KEY, JSON.stringify(config));
    this._key = key;
  }

  logout(): void {
    this._key = null;
  }
}
