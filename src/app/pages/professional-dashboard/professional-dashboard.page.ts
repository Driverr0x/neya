import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendarOutline } from 'ionicons/icons';
import { BrandHeaderComponent } from '../../shared/brand-header.component';
import {
  AccountProfile,
  BackendService,
  CaseStatus,
  PlatformBooking,
  PlatformConversation,
  PlatformMessage,
  PlatformScreening,
  PlatformStructure,
  PlatformVideo,
  Referral,
} from '../core/backend.service';
import { Lang } from '../core/models';
import { formatMoment, formatRange, todayInputValue } from '../core/dates';

const BOOKING_STATUS: Record<string, string> = {
  requested: 'À confirmer',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  completed: 'Terminé',
};

/** Suivi du cas, dans l'ordre du parcours. */
const CASE_STATUS: { value: CaseStatus; label: string }[] = [
  { value: 'received', label: 'Reçu' },
  { value: 'contacted', label: 'Patiente contactée' },
  { value: 'suspected', label: 'Cas suspect (examens en cours)' },
  { value: 'confirmed', label: 'Confirmé (biopsie)' },
  { value: 'ruled_out', label: 'Écarté' },
];

const SPECIALTY_NAME: Record<string, string> = { medecin: 'Médecin', 'sage-femme': 'Sage-femme', psychologue: 'Psychologue' };

const LANGUAGE_NAME: Record<string, string> = { fr: 'Français', en: 'Anglais', moore: 'Mooré', dioula: 'Dioula' };

@Component({
  selector: 'app-professional-dashboard',
  standalone: true,
  imports: [BrandHeaderComponent, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar],
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
  readonly referrals = signal<Referral[]>([]);
  readonly caseStatuses = CASE_STATUS;
  /** Modifications de suivi pas encore enregistrées : identifiant → { statut, note }. */
  readonly caseDrafts = signal<Record<string, { status: CaseStatus; note: string }>>({});
  readonly savingCaseId = signal('');
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
  readonly screeningDate = signal('');
  readonly screeningStartTime = signal('08:00');
  readonly screeningEndTime = signal('12:00');
  readonly today = todayInputValue();
  /** Rappel lisible de la date choisie, sous les champs : « sam. 31 oct. · 8 h 00 – 12 h 00 ». */
  readonly screeningPreview = computed(() => {
    const slot = this.screeningSlot();
    return slot ? formatRange(slot.start, slot.end) : '';
  });
  private unsubscribeConversation?: () => void;

  constructor() {
    addIcons({ calendarOutline });
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
        this.referrals.set(data.referrals);
      } else if (profile.status === 'active') {
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

  caseLabel(status: CaseStatus): string {
    return CASE_STATUS.find((item) => item.value === status)?.label ?? status;
  }

  caseDraft(referral: Referral): { status: CaseStatus; note: string } {
    return this.caseDrafts()[referral.id] ?? { status: referral.case_status, note: referral.follow_up_note ?? '' };
  }

  editCase(referral: Referral, change: Partial<{ status: CaseStatus; note: string }>): void {
    this.caseDrafts.update((drafts) => ({ ...drafts, [referral.id]: { ...this.caseDraft(referral), ...change } }));
  }

  caseChanged(referral: Referral): boolean {
    const draft = this.caseDrafts()[referral.id];
    return !!draft && (draft.status !== referral.case_status || draft.note !== (referral.follow_up_note ?? ''));
  }

  async saveCase(referral: Referral): Promise<void> {
    const draft = this.caseDraft(referral);
    this.savingCaseId.set(referral.id);
    await this.perform(async () => {
      await this.backend.updateReferralCase(referral.id, draft.status, draft.note);
      const note = draft.note.trim() || null;
      this.referrals.update((items) => items.map((item) =>
        item.id === referral.id
          ? { ...item, case_status: draft.status, follow_up_note: note, updated_at: new Date().toISOString() }
          : item,
      ));
      this.caseDrafts.update(({ [referral.id]: _, ...rest }) => rest);
      this.notice.set('Suivi du cas enregistré.');
    });
    this.savingCaseId.set('');
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
      if (!this.screeningTitle().trim()) throw new Error('Donnez un titre au dépistage.');
      if (!this.screeningLocation().trim()) throw new Error('Indiquez le lieu du dépistage.');
      const slot = this.screeningSlot();
      if (!slot) throw new Error('Choisissez la date, l’heure de début et l’heure de fin.');
      if (slot.end <= slot.start) throw new Error('L’heure de fin doit être après l’heure de début.');
      if (slot.end <= new Date()) throw new Error('Cette date est déjà passée.');
      await this.backend.createScreening({
        title: this.screeningTitle().trim(),
        description: this.screeningDescription().trim(),
        location: this.screeningLocation().trim(),
        startsAt: slot.start.toISOString(),
        endsAt: slot.end.toISOString(),
        free: true,
      });
      this.notice.set('Dépistage publié dans la liste des événements.');
      this.screeningTitle.set('');
      this.screeningDescription.set('');
      this.screeningLocation.set('');
      this.screeningDate.set('');
      await this.load();
    });
  }

  async selectConversation(conversation: PlatformConversation): Promise<void> {
    this.unsubscribeConversation?.();
    this.selectedConversationId.set(conversation.id);
    await this.perform(async () => {
      const messages = await this.backend.conversationMessages(conversation.id, 'pro');
      this.conversations.update((items) => items.map((item) =>
        item.id === conversation.id ? { ...item, messages } : item,
      ));
      this.unsubscribeConversation = this.backend.subscribeToConversation(conversation.id, (message) => {
        this.addMessage(conversation.id, message);
      }, (error) => this.error.set(error.message), 'pro');
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
    return formatMoment(value);
  }

  formatRange(start: string, end: string): string {
    return formatRange(start, end);
  }

  bookingStatus(status: string): string {
    return BOOKING_STATUS[status] ?? status;
  }

  specialtyName(specialty: string | null | undefined): string {
    return SPECIALTY_NAME[specialty ?? ''] ?? 'Spécialité non renseignée';
  }

  languageName(language: string): string {
    return LANGUAGE_NAME[language] ?? language;
  }

  private screeningSlot(): { start: Date; end: Date } | null {
    const date = this.screeningDate();
    const start = this.screeningStartTime();
    const end = this.screeningEndTime();
    if (!date || !start || !end) return null;
    // « AAAA-MM-JJTHH:MM » sans fuseau : lu à l'heure locale du téléphone.
    return { start: new Date(`${date}T${start}`), end: new Date(`${date}T${end}`) };
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
