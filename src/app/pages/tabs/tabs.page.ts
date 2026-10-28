import { Component, inject } from '@angular/core';
import { 
  IonTabs, IonTabBar, IonTabButton, IonIcon, 
  IonLabel, IonBadge, ToastController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  playCircleOutline, playCircle, clipboardOutline, clipboard,
  personCircleOutline, locationOutline, location 
} from 'ionicons/icons';
import { StoreService } from '../core/store.service';
import { ReminderService } from '../core/reminder.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [
    IonTabs, IonTabBar, IonTabButton, IonIcon, 
    IonLabel, IonBadge
  ],
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class TabsPage {
  store = inject(StoreService);
  private toast = inject(ToastController);
  private rem = inject(ReminderService);
  private router = inject(Router);

  /** Rappel périodique (à l'ouverture puis toutes les heures) selon la fréquence du niveau. */
  private async remind() {
    if (!this.rem.isDue()) return;
    this.store.markReminded();
    
    const t = await this.toast.create({ 
      message: '🔔 ' + this.rem.message(), 
      duration: 8000, 
      position: 'top', 
      color: 'warning',
      buttons: [{ 
        text: 'Rendez-vous', 
        handler: () => { this.router.navigateByUrl('/tabs/structures'); } 
      }] 
    });
    t.present();
  }

  constructor() {
    addIcons({ 
      playCircleOutline, playCircle, 
      clipboardOutline, clipboard, 
      personCircleOutline,
      locationOutline, location 
    });
    
    setTimeout(() => this.remind(), 1500); 
    setInterval(() => this.remind(), 3_600_000);
    
    this.store.onSent = async n => {
      const t = await this.toast.create({ 
        message: `${n} envoi(s) en attente transmis ✔`, 
        duration: 2500, 
        position: 'top', 
        color: 'success' 
      });
      t.present();
    };
  }
}