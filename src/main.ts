import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Capacitor } from '@capacitor/core';
import { AppModule } from './app/app.module';

if (Capacitor.getPlatform() === 'web') {
  import('jeep-sqlite/loader').then(({ defineCustomElements }) => defineCustomElements(window));
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));