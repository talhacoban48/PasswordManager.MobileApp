import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AuthService } from '../services/auth.service';
import { DatabaseService } from '../services/database.service';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showPasswords = false;

  constructor(
    private auth: AuthService,
    private db: DatabaseService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
  ) {}

  goBack(): void {
    this.router.navigate(['/home']);
  }

  // ── Change Master Password ───────────────────────────────────────────────

  async changeMasterPassword(): Promise<void> {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      await this.showAlert('All password fields are required.');
      return;
    }
    if (this.newPassword.length < 4) {
      await this.showAlert('New password must be at least 4 characters.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      await this.showAlert('New passwords do not match.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Re-encrypting…' });
    await loading.present();

    try {
      const oldKey = await this.auth.login(this.currentPassword);
      if (!oldKey) {
        await loading.dismiss();
        await this.showAlert('Current password is incorrect.');
        return;
      }

      const { key: newKey, config } = await this.auth.prepareNewKey(this.newPassword);
      await this.db.rekey(newKey);
      this.auth.commitKey(config, newKey);

      await loading.dismiss();
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
      await this.showToast('Master password changed successfully.');
    } catch (err) {
      await loading.dismiss();
      await this.showAlert('Failed to change password. Your data is unchanged.');
      console.error(err);
    }
  }

  // ── Export ───────────────────────────────────────────────────────────────

  async exportCsv(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Exporting…' });
    await loading.present();
    try {
      const csv = await this.db.exportToCsv();
      await this.shareText(csv, 'passwords.csv', 'text/csv');
      await loading.dismiss();
    } catch (err) {
      await loading.dismiss();
      await this.showAlert('Export failed.');
      console.error(err);
    }
  }

  async exportExcel(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Exporting…' });
    await loading.present();
    try {
      const buffer = await this.db.exportToExcel();
      const base64 = this.arrayBufferToBase64(buffer);
      const filename = 'passwords.xlsx';
      await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      const uri = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
      await Share.share({ title: 'Password Export', url: uri.uri });
      await loading.dismiss();
    } catch (err) {
      await loading.dismiss();
      await this.showAlert('Export failed.');
      console.error(err);
    }
  }

  // ── Import ───────────────────────────────────────────────────────────────

  async importCsv(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const loading = await this.loadingCtrl.create({ message: 'Importing…' });
    await loading.present();

    try {
      const text = await file.text();
      const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
      const { inserted, updated, skipped } = await this.db.importFromRows(result.data);
      await loading.dismiss();
      await this.showAlert(`Import complete.\nInserted: ${inserted}\nUpdated: ${updated}\nSkipped: ${skipped}`);
      input.value = '';
    } catch (err: unknown) {
      await loading.dismiss();
      const msg = err instanceof Error ? err.message : 'Import failed.';
      await this.showAlert(msg);
      input.value = '';
    }
  }

  async importExcel(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const loading = await this.loadingCtrl.create({ message: 'Importing…' });
    await loading.present();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
      const { inserted, updated, skipped } = await this.db.importFromRows(rows);
      await loading.dismiss();
      await this.showAlert(`Import complete.\nInserted: ${inserted}\nUpdated: ${updated}\nSkipped: ${skipped}`);
      input.value = '';
    } catch (err: unknown) {
      await loading.dismiss();
      const msg = err instanceof Error ? err.message : 'Import failed.';
      await this.showAlert(msg);
      input.value = '';
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async shareText(content: string, filename: string, mimeType: string): Promise<void> {
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    const uri = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({ title: 'Password Export', url: uri.uri });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  private async showAlert(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Password Manager',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }
}
