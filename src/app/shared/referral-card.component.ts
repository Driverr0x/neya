import { Component, computed, inject, input, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, documentTextOutline, lockClosedOutline, sendOutline } from 'ionicons/icons';
import { BackendService, PlatformStructure } from '../pages/core/backend.service';
import { LANG_LABEL, QUESTIONS } from '../pages/core/data';
import { formatMoment } from '../pages/core/dates';
import { Answers, OrientationResult } from '../pages/core/models';
import { StoreService } from '../pages/core/store.service';

/**
 * Après l'évaluation : l'utilisatrice peut envoyer un résumé à une structure de santé.
 * Elle voit exactement ce qui part, choisit la structure et donne son accord exprès (case à cocher).
 * Rien n'est envoyé sans cet accord.
 */
@Component({
  selector: 'app-referral-card',
  standalone: true,
  imports: [IonButton, IonIcon],
  templateUrl: './referral-card.component.html',
  styleUrls: ['./referral-card.component.scss'],
})
export class ReferralCardComponent {
  readonly result = input.required<OrientationResult>();
  readonly answers = input.required<Answers>();

  private readonly backend = inject(BackendService);
  readonly store = inject(StoreService);

  readonly open = signal(false);
  readonly structures = signal<PlatformStructure[]>([]);
  readonly structureId = signal('');
  readonly fullName = signal('');
  readonly phone = signal('');
  readonly consent = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  /** Note rédigée par l'IA pour le soignant (sans nom ni téléphone), visible avant l'accord. */
  readonly aiSummary = signal('');
  readonly aiDrafting = signal(false);
  readonly aiSkipped = signal(false);

  /** Ce qui sera transmis, en clair : l'utilisatrice le relit avant d'accepter. */
  readonly summary = computed(() => {
    const answers = this.answers();
    const result = this.result();
    return {
      age: optionLabel('age', answers['age']) ?? null,
      symptoms: symptomLabels(answers['symptoms']),
      language: LANG_LABEL[result.language] ?? result.language,
      city: typeof answers['city'] === 'string' ? answers['city'] : null,
    };
  });
  readonly sentLabel = computed(() => {
    const sent = this.result().referral;
    return sent ? `Résumé envoyé à ${sent.structureName}, ${formatMoment(new Date(sent.at))}.` : '';
  });

  constructor() {
    addIcons({ checkmarkCircle, documentTextOutline, lockClosedOutline, sendOutline });
  }

  async start(): Promise<void> {
    this.open.set(true);
    this.error.set('');
    if (!this.aiSummary() && !this.aiDrafting()) void this.draftSummary();
    if (this.structures().length) return;
    try {
      const structures = await this.backend.browseStructures();
      // Les structures de la ville choisie d'abord.
      const city = this.summary().city?.toLocaleLowerCase();
      structures.sort((a, b) => Number(b.city.toLocaleLowerCase() === city) - Number(a.city.toLocaleLowerCase() === city));
      this.structures.set(structures);
      if (structures.length) this.structureId.set(structures[0].id);
    } catch {
      this.error.set('La liste des structures n’a pas pu être chargée. Vérifiez votre connexion.');
    }
  }

  /** Si l'IA ne répond pas, le résumé part avec les seules données de l'évaluation. */
  private async draftSummary(): Promise<void> {
    if (!this.store.online()) return;
    this.aiDrafting.set(true);
    try {
      const summary = this.summary();
      this.aiSummary.set(await this.backend.draftReferralSummary({
        result: this.result(),
        ageRange: summary.age,
        symptoms: summary.symptoms,
        city: summary.city,
      }));
    } catch {
      this.aiSummary.set('');
    } finally {
      this.aiDrafting.set(false);
    }
  }

  async send(): Promise<void> {
    this.error.set('');
    const structure = this.structures().find((item) => item.id === this.structureId());
    if (!structure) return this.error.set('Choisissez la structure qui recevra votre résumé.');
    if (this.fullName().trim().length < 2) return this.error.set('Indiquez votre nom.');
    if (this.phone().trim().length < 5) return this.error.set('Indiquez votre numéro : la structure vous appellera.');
    if (!this.consent()) return this.error.set('Cochez la case pour donner votre accord avant l’envoi.');
    if (!this.store.online()) return this.error.set('L’envoi du résumé nécessite une connexion internet.');
    if (this.aiDrafting()) return this.error.set('Patientez : la note pour le soignant est en cours de rédaction.');

    const result = this.result();
    const summary = this.summary();
    this.sending.set(true);
    try {
      await this.backend.sendReferral({
        structureId: structure.id,
        fullName: this.fullName(),
        phone: this.phone(),
        level: result.level,
        title: result.title,
        reasons: result.reasons,
        ageRange: summary.age,
        symptoms: summary.symptoms,
        language: result.language,
        city: summary.city,
        consentAt: new Date().toISOString(),
        aiSummary: this.aiSkipped() ? null : this.aiSummary() || null,
      });
      this.store.setResult({ ...result, referral: { structureName: structure.name, at: Date.now() } });
      this.open.set(false);
      this.consent.set(false);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'L’envoi a échoué. Réessayez.');
    } finally {
      this.sending.set(false);
    }
  }
}

function optionLabel(questionId: string, value: unknown): string | undefined {
  return QUESTIONS.find((question) => question.id === questionId)?.options.find((option) => option.value === value)?.label;
}

function symptomLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item !== 'none')
    .map((item) => optionLabel('symptoms', item) ?? String(item));
}
