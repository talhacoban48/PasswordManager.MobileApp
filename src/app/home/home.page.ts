import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { DatabaseService } from '../services/database.service';
import { EntryListItem } from '../models/entry.model';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  allEntries: EntryListItem[] = [];
  filteredEntries: EntryListItem[] = [];
  searchTerm = '';
  showPassive = false;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private auth: AuthService,
    private db: DatabaseService,
    private router: Router,
    private alertCtrl: AlertController,
  ) {}

  ionViewWillEnter(): void {
    this.loadEntries();
  }

  async loadEntries(): Promise<void> {
    this.allEntries = await this.db.getAll();
    this.applyFilter();
  }

  applyFilter(): void {
    const term = this.searchTerm.toLowerCase();
    this.filteredEntries = this.allEntries
      .filter(e => this.showPassive || e.recordStatus === 1)
      .filter(e => e.appname.toLowerCase().includes(term))
      .sort((a, b) => a.appname.localeCompare(b.appname, 'tr'));
  }

  onSearchChange(event: Event): void {
    const input = event as CustomEvent<{ value: string }>;
    this.searchTerm = (input.detail.value ?? '').trim();
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyFilter(), 300);
  }

  togglePassive(): void {
    this.showPassive = !this.showPassive;
    this.applyFilter();
  }

  openEntry(appname: string): void {
    this.router.navigate(['/entry', appname]);
  }

  addNew(): void {
    this.router.navigate(['/entry', '__new__']);
  }

  openSettings(): void {
    this.router.navigate(['/settings']);
  }

  async logout(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Lock',
      message: 'Lock the app and return to the login screen?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Lock',
          role: 'destructive',
          handler: () => {
            this.auth.logout();
            this.router.navigate(['/login'], { replaceUrl: true });
          },
        },
      ],
    });
    await alert.present();
  }

  isPassive(entry: EntryListItem): boolean {
    return entry.recordStatus === 0;
  }
}
