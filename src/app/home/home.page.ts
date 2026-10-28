import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonButton, IonIcon, IonChip, IonLabel 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  bookOutline, clipboardOutline, chatbubbleEllipsesOutline, 
  locationOutline, wifiOutline, cloudOfflineOutline, shieldCheckmarkOutline 
} from 'ionicons/icons';
import { StoreService } from '../pages/core/store.service';
import { ReminderService } from '../pages/core/reminder.service';
import { BrandHeaderComponent } from '../shared/brand-header.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink, BrandHeaderComponent, IonHeader, IonToolbar, IonTitle, IonContent, 
    IonButton, IonIcon, IonChip, IonLabel
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {
  store = inject(StoreService);
  rem = inject(ReminderService);

  constructor() {
    addIcons({ 
      bookOutline, 
      clipboardOutline, 
      chatbubbleEllipsesOutline, 
      locationOutline, 
      wifiOutline, 
      cloudOfflineOutline, 
      shieldCheckmarkOutline 
    });
  }
}