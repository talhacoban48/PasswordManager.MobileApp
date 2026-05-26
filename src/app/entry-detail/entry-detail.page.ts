import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Clipboard } from '@capacitor/clipboard';
import { DatabaseService } from '../services/database.service';
import { PasswordGenService } from '../services/password-gen.service';
import { Entry } from '../models/entry.model';

@Component({
  selector: 'app-entry-detail',
  templateUrl: './entry-detail.page.html',
  styleUrls: ['./entry-detail.page.scss'],
  standalone: false,
})
export class EntryDetailPage implements OnInit {
  isNew = true;
  appname = '';
  username = '';
  email = '';
  password = '';
  url = '';
  isActive = true;
  createdDate: string | null = null;
  updatedDate: string | null = null;

  showPassword = false;
  generatedPassword = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private db: DatabaseService,
    private pwGen: PasswordGenService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit(): void {
    const param = this.route.snapshot.paramMap.get('appname') ?? '__new__';
    this.isNew = param === '__new__';
    if (!this.isNew) {
      this.appname = param;
      this.loadEntry();
    }
  }

  get title(): string {
    return this.isNew ? 'New Entry' : 'Edit Entry';
  }

  private async loadEntry(): Promise<void> {
    const entry = await this.db.getOne(this.appname);
    if (!entry) {
      await this.router.navigate(['/home'], { replaceUrl: true });
      return;
    }
    this.username = entry.username ?? '';
    this.email = entry.email ?? '';
    this.password = entry.password ?? '';
    this.url = entry.url ?? '';
    this.isActive = entry.recordStatus;
    this.createdDate = entry.createdDate;
    this.updatedDate = entry.updatedDate;
  }

  async save(): Promise<void> {
    if (!this.appname.trim()) {
      await this.showAlert('App Name is required.');
      return;
    }
    if (!this.password.trim()) {
      await this.showAlert('Password is required.');
      return;
    }

    const entry: Omit<Entry, 'createdDate' | 'updatedDate'> = {
      appname: this.appname.trim(),
      username: this.username.trim() || null,
      email: this.email.trim() || null,
      password: this.password,
      url: this.url.trim() || null,
      recordStatus: this.isActive,
    };

    try {
      if (this.isNew) {
        const exists = await this.db.exists(entry.appname);
        if (exists) {
          await this.showAlert(`"${entry.appname}" already exists.`);
          return;
        }
        await this.db.insert(entry);
        await this.showToast('Entry added.');
      } else {
        await this.db.update(entry);
        await this.showToast('Entry updated.');
      }
      await this.router.navigate(['/home'], { replaceUrl: true });
    } catch (err) {
      await this.showAlert('Failed to save entry.');
      console.error(err);
    }
  }

  async deleteEntry(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Entry',
      message: `Delete "${this.appname}"? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            await this.db.delete(this.appname);
            await this.showToast('Entry deleted.');
            await this.router.navigate(['/home'], { replaceUrl: true });
          },
        },
      ],
    });
    await alert.present();
  }

  clearForm(): void {
    this.username = '';
    this.email = '';
    this.password = '';
    this.url = '';
    this.isActive = true;
    this.generatedPassword = '';
    if (this.isNew) this.appname = '';
  }

  generatePassword(): void {
    this.generatedPassword = this.pwGen.generate();
  }

  useGenerated(): void {
    if (this.generatedPassword) {
      this.password = this.generatedPassword;
      this.generatedPassword = '';
    }
  }

  async copy(value: string): Promise<void> {
    if (!value) return;
    await Clipboard.write({ string: value });
    await this.showToast('Copied to clipboard.');
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  goBack(): void {
    this.router.navigate(['/home']);
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
      duration: 2000,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }
}
