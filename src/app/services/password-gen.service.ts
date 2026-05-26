import { Injectable } from '@angular/core';

const LOWER   = Array.from('abcdefghijklmnoprstuvxyz');
const UPPER   = Array.from('ABCDEFGHIJKLMNOPRSTUVXYZ');
const DIGITS  = Array.from('0123456789');
const SPECIAL = Array.from('<>?!}{[]().,;:');
const POOL    = [...LOWER, ...UPPER, ...DIGITS, ...SPECIAL];

@Injectable({ providedIn: 'root' })
export class PasswordGenService {
  generate(length: number = 15): string {
    return Array.from({ length }, () => POOL[Math.floor(Math.random() * POOL.length)]).join('');
  }
}
