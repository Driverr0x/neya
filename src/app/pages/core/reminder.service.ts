import { Injectable, inject } from '@angular/core';
import { StoreService } from './store.service';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly store = inject(StoreService);

  active() {
    return this.store.result();
  }

  message(): string {
    switch (this.active()?.level) {
      case 3:
        return 'Pensez à prendre rendez-vous : le changement que vous avez remarqué doit être vu par un professionnel de santé.';
      case 2:
        return 'Pensez à demander conseil à un professionnel de santé sur le dépistage adapté pour vous.';
      default:
        return 'Pensez à contacter un professionnel de santé si vous avez une question ou une inquiétude.';
    }
  }

  /**
   * Rappel prononcé dans la langue de l'utilisatrice : enregistrement assets/audio/<langue>/rappel-niveau-<n>.mp3,
   * sinon synthèse vocale du texte français (le mooré et le dioula n'ont pas de voix de synthèse).
   */
  audio(): { clip: string; fallback: { text: string; lang: 'fr' } } | null {
    const result = this.active();
    if (!result) return null;
    return { clip: `${result.language}/rappel-niveau-${result.level}`, fallback: { text: this.message(), lang: 'fr' } };
  }

  daysToNext(): number {
    const result = this.active();
    if (!result?.at) return 0;
    const intervalDays = result.level === 3 ? 2 : 7;
    const elapsedDays = Math.floor((Date.now() - result.at) / 86_400_000);
    return Math.max(0, intervalDays - elapsedDays);
  }

  isDue(): boolean {
    const result = this.active();
    if (!result) return false;
    const intervalMs = (result.level === 3 ? 2 : 7) * 86_400_000;
    return !this.store.wasRemindedRecently(intervalMs);
  }
}
