import { Component, inject } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonTitle, IonToggle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline, wifiOutline } from 'ionicons/icons';
import { StoreService } from '../core/store.service';
import { BrandHeaderComponent } from '../../shared/brand-header.component';

@Component({
  selector: 'app-mode',
  templateUrl: './mode.page.html',
  styleUrls: ['./mode.page.scss'],
  standalone: true,
  imports: [BrandHeaderComponent, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonTitle, IonToggle, IonToolbar],
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
