import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { DatabaseService } from '../services/database.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  isSetup = false;
  masterPassword = '';
  confirmPassword = '';
  showPassword = false;

  constructor(
    private auth: AuthService,
    private db: DatabaseService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
  ) {}

  ngOnInit(): void {
    this.isSetup = !this.auth.isConfigured();
  }

  get title(): string {
    return this.isSetup ? 'Create Master Password' : 'Login';
  }

  get subtitle(): string {
    return this.isSetup
      ? 'This password protects all your passwords.\nIf forgotten, data cannot be recovered.'
      : 'Enter your master password to unlock.';
  }

  async submit(): Promise<void> {
    if (!this.masterPassword.trim()) {
      await this.showAlert('Password cannot be empty.');
      return;
    }

    if (this.isSetup) {
      if (this.masterPassword.length < 4) {
        await this.showAlert('Password must be at least 4 characters.');
        return;
      }
      if (this.masterPassword !== this.confirmPassword) {
        await this.showAlert('Passwords do not match.');
        return;
      }
    }

    const loading = await this.loadingCtrl.create({ message: this.isSetup ? 'Setting up…' : 'Logging in…' });
    await loading.present();

    try {
      let key: CryptoKey | null;
      if (this.isSetup) {
        key = await this.auth.setup(this.masterPassword);
      } else {
        key = await this.auth.login(this.masterPassword);
      }

      if (!key) {
        await loading.dismiss();
        await this.showAlert('Wrong password. Please try again.');
        return;
      }

      await this.db.initialize(key);
      await loading.dismiss();
      await this.router.navigate(['/home'], { replaceUrl: true });
    } catch (err) {
      await loading.dismiss();
      await this.showAlert('An error occurred. Please try again.');
      console.error(err);
    }
  }

  private async showAlert(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Password Manager',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
