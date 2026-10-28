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
  calendarOutline, navigateOutline, megaphoneOutline 
} from 'ionicons/icons';
import { STRUCTURES, screeningsThisMonth } from '../core/data';
import { PlatformScreening, PlatformStructure, BackendService } from '../core/backend.service';
import { Structure } from '../core/models';
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
      calendarOutline, navigateOutline, megaphoneOutline 
    });
    void this.loadPlatformData();
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
      const [structures, screenings] = await Promise.all([
        this.backend.browseStructures(),
        this.backend.browseScreenings(),
      ]);
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

  isPast(d: Date) { 
    const t = new Date(); 
    t.setHours(0, 0, 0, 0); 
    return d < t; 
  }

  dateLabel(value: string) { 
    return new Date(value).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); 
  }

  eventTime(value: string): string {
    return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  eventEnded(value: string): boolean {
    return this.isPast(new Date(value));
  }

  async book(s: Structure, slot: string) {
    if (this.backend.configured) {
      if (!this.store.online()) {
        this.error.set('La demande de rendez-vous nécessite une connexion internet.');
        return;
      }
      const requestedSlot = this.appointmentSlot().trim();
      if (this.fullName().trim().length < 2 || this.phone().trim().length < 5 || !requestedSlot) {
        this.error.set('Indiquez votre nom, votre téléphone et le créneau souhaité.');
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
      if (!this.store.online()) {
        this.error.set('L’inscription au dépistage nécessite une connexion internet.');
        return;
      }
      if (this.fullName().trim().length < 2 || this.phone().trim().length < 5) {
        this.error.set('Indiquez votre nom et votre téléphone pour vous inscrire.');
        return;
      }
      try {
        await this.backend.submitBooking({
          structureId: event.structure_id,
          kind: 'screening',
          fullName: this.fullName(),
          phone: this.phone(),
          screeningEventId: event.id,
        });
        this.error.set('');
        this.router.navigate(['/tabs/confirmation/rdv'], {
          queryParams: {
            pro: structure.name,
            slot: `${this.dateLabel(event.starts_at)} · ${event.location || structure.city}`,
            mode: 'cabinet',
            status: 'sent',
          },
        });
        return;
      } catch (error) {
        this.error.set(error instanceof Error ? error.message : 'Impossible de vous inscrire à ce dépistage.');
        return;
      }
    }

    await this.book(structure, `${this.dateLabel(event.starts_at)} ${event.location || structure.city}`);
  }

  eventMapUrl(event: PlatformScreening): string {
    const location = event.location || `${event.structures?.name ?? ''} ${event.structures?.city ?? ''}`;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location);
  }
}