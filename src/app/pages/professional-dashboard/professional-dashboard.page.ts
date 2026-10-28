import { Component, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { BrandHeaderComponent } from '../../shared/brand-header.component';
import {
  AccountProfile,
  BackendService,
  PlatformBooking,
  PlatformConversation,
  PlatformMessage,
  PlatformScreening,
  PlatformStructure,
  PlatformVideo,
} from '../core/backend.service';
import { Lang } from '../core/models';

@Component({
  selector: 'app-professional-dashboard',
  standalone: true,
  imports: [BrandHeaderComponent, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './professional-dashboard.page.html',
  styleUrls: ['./professional-dashboard.page.scss'],
})
export class ProfessionalDashboardPage implements OnDestroy {
  private readonly backend = inject(BackendService);
  private readonly router = inject(Router);

  readonly profile = signal<AccountProfile | null>(null);
  readonly structure = signal<PlatformStructure | null>(null);
  readonly doctors = signal<AccountProfile[]>([]);
  readonly videos = signal<PlatformVideo[]>([]);
  readonly bookings = signal<PlatformBooking[]>([]);
  readonly screenings = signal<PlatformScreening[]>([]);
  readonly conversations = signal<PlatformConversation[]>([]);
  readonly selectedConversationId = signal('');
  readonly selectedConversation = () =>
    this.conversations().find((item) => item.id === this.selectedConversationId()) ?? null;
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly inviteCode = signal('');
  readonly replyDraft = signal('');
  readonly videoTitle = signal('');
  readonly videoDescription = signal('');
  readonly videoLanguage = signal<Lang>('fr');
  readonly videoFile = signal<File | null>(null);
  readonly screeningTitle = signal('');
  readonly screeningDescription = signal('');
  readonly screeningLocation = signal('');
  readonly screeningStartsAt = signal('');
  readonly screeningEndsAt = signal('');
  private unsubscribeConversation?: () => void;

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.unsubscribeConversation?.();
  }

  async signOut(): Promise<void> {
    try {
      await this.backend.signOut();
      await this.router.navigateByUrl('/professional-access');
    } catch (error) {
      this.error.set(this.errorMessage(error));
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const profile = await this.backend.currentProfile();
      if (!profile || profile.role === 'patient') {
        await this.router.navigateByUrl('/professional-access');
        return;
      }
      this.profile.set(profile);

      if (profile.role === 'structure_admin') {
        const data = await this.backend.structureDashboard();
        this.structure.set(data.structure);
        this.doctors.set(data.doctors);
        this.videos.set(data.videos);
        this.bookings.set(data.bookings);
        this.screenings.set(data.screenings);
      } else {
        this.conversations.set(await this.backend.manageDoctorConversations());
      }
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async createInvite(): Promise<void> {
    await this.perform(async () => {
      this.inviteCode.set(await this.backend.createDoctorInvite());
      this.notice.set('Code créé. Transmettez-le directement au médecin; il expirera dans 7 jours.');
    });
  }

  async updateBooking(booking: PlatformBooking, status: 'confirmed' | 'cancelled' | 'completed'): Promise<void> {
    await this.perform(async () => {
      await this.backend.setBookingStatus(booking.id, status);
      this.bookings.update((items) => items.map((item) => item.id === booking.id ? { ...item, status } : item));
      this.notice.set('Statut de la demande mis à jour.');
    });
  }

  fileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.videoFile.set(input.files?.[0] ?? null);
  }

  async uploadVideo(): Promise<void> {
    const file = this.videoFile();
    if (!file) {
      this.error.set('Sélectionnez une vidéo avant de l’envoyer.');
      return;
    }
    await this.perform(async () => {
      await this.backend.uploadVideo({
        title: this.videoTitle(),
        description: this.videoDescription(),
        language: this.videoLanguage(),
        file,
      });
      this.videoTitle.set('');
      this.videoDescription.set('');
      this.videoFile.set(null);
      this.notice.set('Vidéo publiée.');
      await this.load();
    });
  }

  async createScreening(): Promise<void> {
    await this.perform(async () => {
      if (!this.screeningStartsAt() || !this.screeningEndsAt()) {
        throw new Error('Indiquez la date et l’heure de début et de fin.');
      }
      await this.backend.createScreening({
        title: this.screeningTitle(),
        description: this.screeningDescription(),
        location: this.screeningLocation(),
        startsAt: new Date(this.screeningStartsAt()).toISOString(),
        endsAt: new Date(this.screeningEndsAt()).toISOString(),
        free: true,
      });
      this.notice.set('Dépistage publié dans la liste des événements.');
      this.screeningTitle.set('');
      this.screeningDescription.set('');
      this.screeningStartsAt.set('');
      this.screeningEndsAt.set('');
      await this.load();
    });
  }

  async selectConversation(conversation: PlatformConversation): Promise<void> {
    this.unsubscribeConversation?.();
    this.selectedConversationId.set(conversation.id);
    await this.perform(async () => {
      const messages = await this.backend.conversationMessages(conversation.id);
      this.conversations.update((items) => items.map((item) =>
        item.id === conversation.id ? { ...item, messages } : item,
      ));
      this.unsubscribeConversation = this.backend.subscribeToConversation(conversation.id, (message) => {
        this.addMessage(conversation.id, message);
      }, (error) => this.error.set(error.message));
    });
  }

  async sendReply(): Promise<void> {
    const conversationId = this.selectedConversationId();
    const content = this.replyDraft().trim();
    if (!conversationId || !content) return;
    await this.perform(async () => {
      await this.backend.sendDoctorReply(conversationId, content);
      this.replyDraft.set('');
    });
  }

  formatTime(value: string): string {
    return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }

  private addMessage(conversationId: string, message: PlatformMessage): void {
    this.conversations.update((items) => items.map((item) => {
      if (item.id !== conversationId) return item;
      const existing = item.messages ?? [];
      if (existing.some((current) => current.id === message.id)) return item;
      return { ...item, messages: [...existing, message] };
    }));
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.';
  }
}
