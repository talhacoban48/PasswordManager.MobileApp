import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { CryptoService } from './crypto.service';
import { Entry, EntryListItem } from '../models/entry.model';

const DB_NAME = 'pwapp';
const COLUMNS = ['appname', 'username', 'email', 'password', 'url', 'recordStatus', 'createdDate', 'updatedDate'];

function nowStr(): string {
  return new Date().toISOString().substring(0, 19);
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value);
  return (s === '' || s === 'None' || s === 'nan' || s === 'null' || s === 'undefined') ? null : s;
}

function toStatus(value: unknown): number {
  if (value === null || value === undefined) return 1;
  const s = String(value).trim().toLowerCase();
  return (s === 'false' || s === '0') ? 0 : 1;
}

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private sqlite: SQLiteConnection;
  private db!: SQLiteDBConnection;
  private key!: CryptoKey;

  constructor(private crypto: CryptoService) {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  async initialize(key: CryptoKey): Promise<void> {
    this.key = key;
    if (Capacitor.getPlatform() === 'web') {
      await customElements.whenDefined('jeep-sqlite');
      await this.sqlite.initWebStore();
    }
    const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;
    if (isConn) {
      this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
    } else {
      this.db = await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    }
    await this.db.open();
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS passwords (
        appname      TEXT PRIMARY KEY,
        username     TEXT,
        email        TEXT,
        password     TEXT,
        url          TEXT,
        recordStatus INTEGER NOT NULL DEFAULT 1,
        createdDate  TEXT,
        updatedDate  TEXT
      )
    `);
  }

  private async rowToEntry(row: Record<string, unknown>): Promise<Entry> {
    const encPw = row['password'] as string | null;
    const password = encPw ? await this.crypto.decrypt(encPw, this.key) : '';
    return {
      appname: row['appname'] as string,
      username: clean(row['username']),
      email: clean(row['email']),
      password,
      url: clean(row['url']),
      recordStatus: Boolean(row['recordStatus']),
      createdDate: clean(row['createdDate']),
      updatedDate: clean(row['updatedDate']),
    };
  }

  async getAll(): Promise<EntryListItem[]> {
    const result = await this.db.query('SELECT appname, recordStatus FROM passwords');
    return (result.values ?? []).map(r => ({ appname: r['appname'], recordStatus: r['recordStatus'] }));
  }

  async getOne(appname: string): Promise<Entry | null> {
    const result = await this.db.query('SELECT * FROM passwords WHERE appname = ?', [appname]);
    if (!result.values || result.values.length === 0) return null;
    return this.rowToEntry(result.values[0]);
  }

  async exists(appname: string): Promise<boolean> {
    const result = await this.db.query('SELECT 1 FROM passwords WHERE appname = ?', [appname]);
    return (result.values ?? []).length > 0;
  }

  async insert(entry: Omit<Entry, 'createdDate' | 'updatedDate'>): Promise<void> {
    const encPw = await this.crypto.encrypt(entry.password, this.key);
    await this.db.run(
      `INSERT INTO passwords (appname, username, email, password, url, recordStatus, createdDate, updatedDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [entry.appname, clean(entry.username), clean(entry.email), encPw,
       clean(entry.url), entry.recordStatus ? 1 : 0, nowStr(), null]
    );
  }

  async update(entry: Omit<Entry, 'createdDate' | 'updatedDate'>): Promise<void> {
    const encPw = await this.crypto.encrypt(entry.password, this.key);
    await this.db.run(
      `UPDATE passwords SET username=?, email=?, password=?, url=?, recordStatus=?, updatedDate=?
       WHERE appname=?`,
      [clean(entry.username), clean(entry.email), encPw, clean(entry.url),
       entry.recordStatus ? 1 : 0, nowStr(), entry.appname]
    );
  }

  async delete(appname: string): Promise<void> {
    await this.db.run('DELETE FROM passwords WHERE appname = ?', [appname]);
  }

  async rekey(newKey: CryptoKey): Promise<void> {
    const result = await this.db.query('SELECT appname, password FROM passwords');
    for (const row of (result.values ?? [])) {
      if (row['password']) {
        const plaintext = await this.crypto.decrypt(row['password'], this.key);
        const reencrypted = await this.crypto.encrypt(plaintext, newKey);
        await this.db.run('UPDATE passwords SET password=? WHERE appname=?', [reencrypted, row['appname']]);
      }
    }
    this.key = newKey;
  }

  private async getAllDecrypted(): Promise<Record<string, unknown>[]> {
    const result = await this.db.query('SELECT * FROM passwords');
    const out: Record<string, unknown>[] = [];
    for (const row of (result.values ?? [])) {
      const entry = await this.rowToEntry(row);
      out.push({
        appname: entry.appname,
        username: entry.username ?? '',
        email: entry.email ?? '',
        password: entry.password ?? '',
        url: entry.url ?? '',
        recordStatus: entry.recordStatus ? 1 : 0,
        createdDate: entry.createdDate ?? '',
        updatedDate: entry.updatedDate ?? '',
      });
    }
    return out;
  }

  async exportToCsv(): Promise<string> {
    const rows = await this.getAllDecrypted();
    return Papa.unparse(rows, { columns: COLUMNS });
  }

  async exportToExcel(): Promise<ArrayBuffer> {
    const rows = await this.getAllDecrypted();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });
    XLSX.utils.book_append_sheet(wb, ws, 'Passwords');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  }

  async importFromRows(rows: Record<string, unknown>[]): Promise<{ inserted: number; updated: number; skipped: number }> {
    const required = ['appname', 'username', 'email', 'password', 'url', 'recordStatus'];
    if (rows.length > 0) {
      const missing = required.filter(c => !(c in rows[0]));
      if (missing.length > 0) throw new Error(`Missing columns: ${missing.join(', ')}`);
    }

    let inserted = 0, updated = 0, skipped = 0;

    for (const row of rows) {
      const appname = clean(String(row['appname'] ?? ''));
      if (!appname) { skipped++; continue; }

      const rawPassword = clean(String(row['password'] ?? '')) ?? '';
      const recordStatus = toStatus(row['recordStatus']);
      const importedUpdatedDate = clean(String(row['updatedDate'] ?? ''));

      const existsResult = await this.db.query(
        'SELECT updatedDate FROM passwords WHERE appname = ?', [appname]
      );
      const existing = existsResult.values?.[0];

      if (!existing) {
        const encPw = await this.crypto.encrypt(rawPassword, this.key);
        const createdDate = clean(String(row['createdDate'] ?? '')) ?? nowStr();
        await this.db.run(
          `INSERT INTO passwords (appname, username, email, password, url, recordStatus, createdDate, updatedDate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [appname, clean(String(row['username'] ?? '')), clean(String(row['email'] ?? '')),
           encPw, clean(String(row['url'] ?? '')), recordStatus, createdDate, importedUpdatedDate]
        );
        inserted++;
      } else {
        const dbUpdatedDate = existing['updatedDate'] as string | null;
        const isNewer = importedUpdatedDate !== null &&
          (dbUpdatedDate === null || importedUpdatedDate > dbUpdatedDate);

        if (isNewer) {
          const encPw = await this.crypto.encrypt(rawPassword, this.key);
          await this.db.run(
            `UPDATE passwords SET username=?, email=?, password=?, url=?, recordStatus=?, updatedDate=?
             WHERE appname=?`,
            [clean(String(row['username'] ?? '')), clean(String(row['email'] ?? '')),
             encPw, clean(String(row['url'] ?? '')), recordStatus, importedUpdatedDate, appname]
          );
          updated++;
        } else {
          skipped++;
        }
      }
    }

    return { inserted, updated, skipped };
  }
}
