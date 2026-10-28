import { Component, inject } from '@angular/core';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline, wifiOutline } from 'ionicons/icons';
import { StoreService } from '../core/store.service';

@Component({
  selector: 'app-mode',
  templateUrl: './mode.page.html',
  styleUrls: ['./mode.page.scss'],
  standalone: false,
})
export class ModePage {
  readonly store = inject(StoreService);

  constructor() {
    addIcons({ cloudOfflineOutline, wifiOutline });
  }

  setOnline(online: boolean): void {
    if (this.store.online() !== online) {
      this.store.toggleOffline();
    }
  }
}
