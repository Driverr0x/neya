import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonButton, IonIcon 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, timeOutline } from 'ionicons/icons';
import { BrandHeaderComponent } from '../../shared/brand-header.component';

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [
    RouterLink, BrandHeaderComponent, IonHeader, IonToolbar, IonTitle, IonContent, 
    IonButton, IonIcon
  ],
  templateUrl: './confirmation.page.html',
  styleUrls: ['./confirmation.page.scss'],
})
export class ConfirmationPage {
  private readonly route = inject(ActivatedRoute);

  get rdv() {
    return this.route.snapshot.paramMap.get('kind') === 'rdv';
  }

  get pro() {
    return this.route.snapshot.queryParamMap.get('pro') ?? 'un professionnel';
  }

  get slot() {
    return this.route.snapshot.queryParamMap.get('slot') ?? '';
  }

  get mode() {
    return this.route.snapshot.queryParamMap.get('mode') ?? 'remote';
  }

  get pending() {
    return this.route.snapshot.queryParamMap.get('status') === 'pending';
  }

  get requestSent() {
    const status = this.route.snapshot.queryParamMap.get('status');
    return status === 'sent' || status === 'requested';
  }

  get title() {
    if (this.pending) return 'En attente d’envoi';
    if (this.rdv && this.requestSent) return 'Demande envoyée';
    return this.rdv ? 'Rendez-vous confirmé' : 'Message envoyé';
  }

  get description() {
    if (this.rdv && this.pending) {
      return `Votre demande auprès de ${this.pro} (${this.slot}) est enregistrée sur ce téléphone.`;
    }
    if (this.rdv && this.requestSent) {
      return `Votre demande auprès de ${this.pro} a été transmise. La structure vous contactera pour confirmer le créneau ${this.slot}.`;
    }
    return this.rdv
      ? `Avec ${this.pro} — ${this.slot} (${this.mode === 'cabinet' ? 'au cabinet' : 'à distance'})`
      : `À ${this.pro}. Vous recevrez une réponse dans le délai annoncé.`;
  }

  constructor() { 
    addIcons({ checkmarkCircle, timeOutline }); 
  }
}