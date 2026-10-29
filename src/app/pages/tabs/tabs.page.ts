import { Component, inject, viewChild } from '@angular/core';
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
import { OutboxService } from '../core/outbox.service';
import { AudioGuideService } from '../core/audio-guide.service';
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
  private outbox = inject(OutboxService);
  private audioGuide = inject(AudioGuideService);
  private readonly tabs = viewChild.required(IonTabs);
  private switching = false;
  private queuedTab = '';
  private switchTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Deux touchers rapprochés sur des onglets différents lancent deux transitions Ionic qui se
   * chevauchent : l'URL change mais l'écran reste sur l'ancien onglet. On n'en lance donc
   * qu'une à la fois ; un toucher pendant une transition est appliqué juste après.
   */
  onTabButton(event: Event): void {
    const tab = (event as CustomEvent<{ tab: string }>).detail?.tab ?? '';
    if (this.switching) {
      event.stopPropagation();
      this.queuedTab = tab;
      return;
    }
    // Onglet déjà actif : Ionic revient à sa racine sans changer d'onglet, rien à attendre.
    if (!tab || tab === this.tabs().getSelected()) return;
    this.switching = true;
    // Filet de sécurité si Ionic ne signale jamais la fin du changement.
    this.switchTimeout = setTimeout(() => this.onTabChanged(), 2000);
  }

  onTabChanged(): void {
    clearTimeout(this.switchTimeout);
    this.switching = false;
    const queued = this.queuedTab;
    this.queuedTab = '';
    if (queued && queued !== this.tabs().getSelected()) {
      this.switching = true;
      this.switchTimeout = setTimeout(() => this.onTabChanged(), 2000);
      void this.tabs().select(queued);
    }
  }

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
    await t.present();
    const audio = this.rem.audio();
    if (audio) void this.audioGuide.say(audio.clip, audio.fallback);
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
        message: n > 1 ? `${n} demandes en attente envoyées ✔` : 'Votre demande en attente a été envoyée ✔', 
        duration: 2500, 
        position: 'top', 
        color: 'success' 
      });
      t.present();
    };
    // Demandes faites hors connexion lors d'une visite précédente : envoyées dès maintenant si possible.
    this.outbox.start();
  }
}