import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonSearchbar, IonIcon, IonButton, IonChip, 
  IonSegment, IonSegmentButton, IonLabel 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  callOutline, timeOutline, locationOutline, 
  calendarOutline, navigateOutline, megaphoneOutline,
  checkmarkCircle, closeCircle,
} from 'ionicons/icons';
import { STRUCTURES, screeningsThisMonth } from '../core/data';
import {
  AlreadyRegisteredError, BackendService, PlatformBooking, PlatformScreening, PlatformStructure,
} from '../core/backend.service';
import { Structure } from '../core/models';
import { calendarParts, formatRange } from '../core/dates';
import { StoreService } from '../core/store.service';
import { BrandHeaderComponent } from '../../shared/brand-header.component';

@Component({
  selector: 'app-structures',
  standalone: true,
  imports: [
    BrandHeaderComponent, IonHeader, IonToolbar, IonTitle, IonContent, 
    IonSearchbar, IonIcon, IonButton, IonChip, 
    IonSegment, IonSegmentButton, IonLabel
  ],
  templateUrl: './structures.page.html',
  styleUrls: ['./structures.page.scss'],
})
export class StructuresPage {
  store = inject(StoreService);
  private router = inject(Router);
  readonly backend = inject(BackendService);
  
  view = signal<'list' | 'month'>('list');
  q = signal('');
  open = signal('');
  slot = signal('');
  fullName = signal('');
  /** Dépistages où la visiteuse est déjà inscrite (identifiant → statut). */
  registrations = signal<Record<string, PlatformBooking['status']>>({});
  /** Message affiché dans la carte concernée, pas en haut de la page. */
  eventMessages = signal<Record<string, string>>({});
  registeringId = signal('');
  phone = signal('');
  appointmentSlot = signal('');
  error = signal('');
  structures = signal<Structure[]>(this.backend.configured ? [] : STRUCTURES);
  events = signal<PlatformScreening[]>(this.backend.configured ? [] : this.demoScreenings());

  list = computed(() => { 
    const t = this.q().toLowerCase(); 
    return this.structures().filter(s => (s.name + s.city + s.services.join(' ')).toLowerCase().includes(t)); 
  });

  constructor() {
    addIcons({ 
      callOutline, timeOutline, locationOutline, 
      calendarOutline, navigateOutline, megaphoneOutline,
      checkmarkCircle, closeCircle,
    });
    void this.loadPlatformData();
  }

  /** Au retour sur la page : la structure a peut-être confirmé ou annulé une inscription entre-temps. */
  ionViewWillEnter(): void {
    if (!this.backend.configured || !this.store.online()) return;
    void this.backend.myScreeningRegistrations()
      .then((registrations) => this.registrations.set(registrations))
      .catch(() => undefined);
  }

  private demoScreenings(): PlatformScreening[] {
    return screeningsThisMonth().map((event) => ({
      id: event.id,
      structure_id: event.structureId,
      title: event.title,
      description: '',
      starts_at: event.date.toISOString(),
      ends_at: new Date(event.date.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      location: '',
      free: event.free,
      structures: {
        name: STRUCTURES.find((structure) => structure.id === event.structureId)?.name ?? '',
        city: STRUCTURES.find((structure) => structure.id === event.structureId)?.city ?? '',
      },
    }));
  }

  private async loadPlatformData(): Promise<void> {
    if (!this.backend.configured) return;
    try {
      await this.backend.ensureVisitorSession();
      const [structures, screenings, registrations] = await Promise.all([
        this.backend.browseStructures(),
        this.backend.browseScreenings(),
        // Sans cette liste, la page proposerait encore de s'inscrire : ce n'est pas bloquant.
        this.backend.myScreeningRegistrations().catch(() => ({})),
      ]);
      this.registrations.set(registrations);
      this.structures.set(structures.map((structure) => ({
        id: structure.id,
        name: structure.name,
        city: structure.city,
        hours: 'Créneaux selon disponibilité',
        phone: structure.phone,
        services: ['Dépistage', 'Consultation'],
        slots: [],
      })));
      this.events.set(screenings);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Impossible de charger les structures.');
    }
  }

  structure(id: string): Structure { 
    const structure = this.structures().find(s => s.id === id);
    if (!structure) {
      throw new Error(`Unknown structure id: ${id}`);
    }
    return structure;
  }

  mapUrl(s: Structure) { 
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${s.name} ${s.city}`); 
  }

  calendar(value: string) {
    return calendarParts(value);
  }

  eventRange(event: PlatformScreening): string {
    return formatRange(event.starts_at, event.ends_at);
  }

  eventEnded(value: string): boolean {
    return new Date(value) < new Date();
  }

  async book(s: Structure, slot: string) {
    if (this.backend.configured) {
      const requestedSlot = this.appointmentSlot().trim();
      if (this.fullName().trim().length < 2 || this.phone().trim().length < 5 || !requestedSlot) {
        this.error.set('Indiquez votre nom, votre téléphone et le créneau souhaité.');
        return;
      }
      if (!this.store.online()) {
        // Sans réseau : la demande attend sur le téléphone et partira au retour de la connexion.
        this.store.submit({
          kind: 'appointment',
          proName: s.name,
          structureId: s.id,
          slot: requestedSlot,
          mode: 'cabinet',
          booking: {
            structureId: s.id,
            kind: 'appointment',
            fullName: this.fullName().trim(),
            phone: this.phone().trim(),
            slotLabel: requestedSlot,
          },
        });
        this.error.set('');
        this.open.set('');
        this.router.navigate(['/tabs/confirmation/rdv'], {
          queryParams: { pro: s.name, slot: requestedSlot, mode: 'cabinet', status: 'pending' },
        });
        return;
      }
      try {
        await this.backend.submitBooking({
          structureId: s.id,
          kind: 'appointment',
          fullName: this.fullName(),
          phone: this.phone(),
          slotLabel: requestedSlot,
        });
        this.error.set('');
        this.router.navigate(['/tabs/confirmation/rdv'], {
          queryParams: { pro: s.name, slot: requestedSlot, mode: 'cabinet', status: 'sent' },
        });
        return;
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : 'Impossible d’envoyer la demande de rendez-vous.');
        return;
      }
    }

    const it = this.store.submit({ 
      kind: 'appointment', 
      proId: s.id, 
      proName: s.name, 
      structureId: s.id, 
      slot, 
      mode: 'cabinet' 
    });
    this.open.set(''); 
    this.slot.set('');
    this.router.navigate(['/tabs/confirmation/rdv'], { 
      queryParams: { pro: s.name, slot, mode: 'cabinet', status: it.status } 
    });
  }

  async registerScreening(event: PlatformScreening): Promise<void> {
    const structure = this.structures().find((item) => item.id === event.structure_id);
    if (!structure) {
      this.error.set('La structure de ce dépistage n’est plus disponible.');
      return;
    }

    if (this.backend.configured) {
      this.setEventMessage(event.id, '');
      if (this.fullName().trim().length < 2) {
        this.setEventMessage(event.id, 'Indiquez votre nom pour vous inscrire.');
        return;
      }
      if (this.phone().trim().length < 5) {
        this.setEventMessage(event.id, 'Indiquez votre numéro de téléphone : la structure vous appellera pour confirmer.');
        return;
      }
      if (!this.store.online()) {
        // Sans réseau : l'inscription attend sur le téléphone et partira au retour de la connexion.
        this.store.submit({
          kind: 'appointment',
          proName: structure.name,
          structureId: structure.id,
          slot: `Dépistage · ${this.eventRange(event)}`,
          mode: 'cabinet',
          booking: {
            structureId: event.structure_id,
            kind: 'screening',
            fullName: this.fullName().trim(),
            phone: this.phone().trim(),
            screeningEventId: event.id,
          },
        });
        return;
      }
      this.registeringId.set(event.id);
      try {
        await this.backend.submitBooking({
          structureId: event.structure_id,
          kind: 'screening',
          fullName: this.fullName(),
          phone: this.phone(),
          screeningEventId: event.id,
        });
        this.markRegistered(event.id, 'requested');
        this.router.navigate(['/tabs/confirmation/rdv'], {
          queryParams: {
            pro: structure.name,
            slot: `${this.eventRange(event)} · ${event.location || structure.city}`,
            mode: 'cabinet',
            status: 'sent',
          },
        });
        return;
      } catch (error) {
        if (error instanceof AlreadyRegisteredError) {
          // Inscription faite plus tôt : on affiche simplement la carte « Vous êtes inscrite ».
          this.markRegistered(event.id, this.registrations()[event.id] ?? 'requested');
        } else {
          this.setEventMessage(event.id, error instanceof Error ? error.message : 'Impossible de vous inscrire à ce dépistage. Réessayez.');
        }
        return;
      } finally {
        this.registeringId.set('');
      }
    }

    await this.book(structure, `${this.eventRange(event)} · ${event.location || structure.city}`);
  }

  /** Inscription faite hors connexion, pas encore arrivée sur le serveur. */
  isQueued(eventId: string): boolean {
    return this.store.pendingBookings().some((item) => item.booking?.screeningEventId === eventId);
  }

  registrationNote(status: PlatformBooking['status']): string {
    switch (status) {
      case 'confirmed':
        return 'Votre place est confirmée. Présentez-vous à l’heure indiquée.';
      case 'cancelled':
        return 'Votre inscription a été annulée par la structure. Appelez-la pour en savoir plus.';
      case 'completed':
        return 'Vous avez participé à ce dépistage.';
      default:
        return 'La structure va vous appeler pour confirmer votre place.';
    }
  }

  private markRegistered(eventId: string, status: PlatformBooking['status']): void {
    this.registrations.update((current) => ({ ...current, [eventId]: status }));
    this.setEventMessage(eventId, '');
  }

  private setEventMessage(eventId: string, message: string): void {
    this.eventMessages.update((current) => ({ ...current, [eventId]: message }));
  }

  eventMapUrl(event: PlatformScreening): string {
    const location = event.location || `${event.structures?.name ?? ''} ${event.structures?.city ?? ''}`;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location);
  }
}