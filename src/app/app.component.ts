import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, Platform } from '@ionic/angular';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private exitAlertOpen = false;
  private ignoredUntil = 0;

  constructor(
    private platform: Platform,
    private router: Router,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit(): void {
    this.platform.ready().then(() => {
      this.platform.backButton.subscribeWithPriority(10, () => {
        // Herhangi bir Ionic overlay (alert, loading, toast vs.) açıksa dokunma
        if (document.querySelector('ion-alert, ion-loading, ion-action-sheet')) return;
        // Navigation sonrası kısa bekleme penceresi
        if (Date.now() < this.ignoredUntil) return;

        const url = this.router.url.split('?')[0];
        const isRoot = url === '/home' || url === '/login' || url === '/';
        if (isRoot) {
          this.confirmExit();
        } else {
          this.ignoredUntil = Date.now() + 600;
          this.router.navigate(['/home'], { replaceUrl: true });
        }
      });
    });
  }

  private async confirmExit(): Promise<void> {
    if (this.exitAlertOpen) return;
    this.exitAlertOpen = true;
    const alert = await this.alertCtrl.create({
      header: 'Exit',
      message: 'Are you sure you want to exit?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Exit', role: 'destructive', handler: () => App.exitApp() },
      ],
    });
    alert.onDidDismiss().then(() => {
      this.exitAlertOpen = false;
      this.ignoredUntil = Date.now() + 400;
    });
    await alert.present();
  }
}
