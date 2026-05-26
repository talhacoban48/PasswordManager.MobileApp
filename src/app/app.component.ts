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

  constructor(
    private platform: Platform,
    private router: Router,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit(): void {
    this.platform.ready().then(() => {
      App.addListener('backButton', ({ canGoBack }) => {
        if (this.exitAlertOpen) return;
        if (canGoBack) {
          window.history.back();
        } else {
          this.confirmExit();
        }
      });
    });
  }

  private async confirmExit(): Promise<void> {
    this.exitAlertOpen = true;
    const alert = await this.alertCtrl.create({
      header: 'Exit',
      message: 'Are you sure you want to exit?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => { this.exitAlertOpen = false; },
        },
        {
          text: 'Exit',
          role: 'destructive',
          handler: () => App.exitApp(),
        },
      ],
    });
    alert.onDidDismiss().then(() => { this.exitAlertOpen = false; });
    await alert.present();
  }
}
