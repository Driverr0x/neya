import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { copyOutline, keyOutline, phonePortraitOutline } from 'ionicons/icons';
import { BackendService, RecoveredData } from '../core/backend.service';
import { StoreService } from '../core/store.service';
import { BrandHeaderComponent } from '../../shared/brand-header.component';

/** Le dernier code reste visible sur ce téléphone, pour pouvoir le recopier plus tard. */
const CODE_KEY = 'neya-recovery-code';

export function savedRecoveryCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? '';
  } catch {
    return '';
  }
}

@Component({
  selector: 'app-recovery',
  standalone: true,
  imports: [
    RouterLink, BrandHeaderComponent,
    IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar,
  ],
  templateUrl: './recovery.page.html',
  styleUrls: ['./recovery.page.scss'],
})
export class RecoveryPage {
  readonly store = inject(StoreService);
  readonly backend = inject(BackendService);

  readonly code = signal(savedRecoveryCode());
  readonly creating = signal(false);
  readonly copied = signal(false);
  readonly createError = signal('');
  /** Remplacer le code rend l'ancien inutilisable : on demande de confirmer. */
  readonly confirmReplace = signal(false);

  readonly typedCode = signal('');
  readonly redeeming = signal(false);
  readonly redeemError = signal('');
  readonly recovered = signal<RecoveredData | null>(null);

  constructor() {
    addIcons({ copyOutline, keyOutline, phonePortraitOutline });
  }

  async createCode(): Promise<void> {
    this.confirmReplace.set(false);
    this.creating.set(true);
    this.createError.set('');
    try {
      this.keep(await this.backend.createRecoveryCode());
    } catch (error) {
      this.createError.set(error instanceof Error ? error.message : 'Le code n’a pas pu être créé.');
    } finally {
      this.creating.set(false);
    }
  }

  async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    } catch {
      // Copie refusée : le code reste affiché, à recopier à la main.
    }
  }

  async redeem(): Promise<void> {
    this.redeeming.set(true);
    this.redeemError.set('');
    try {
      const { moved, code } = await this.backend.redeemRecoveryCode(this.typedCode());
      this.keep(code);
      this.recovered.set(moved);
      this.typedCode.set('');
    } catch (error) {
      this.redeemError.set(error instanceof Error ? error.message : 'La récupération n’a pas abouti.');
    } finally {
      this.redeeming.set(false);
    }
  }

  recoveredSummary(moved: RecoveredData): string {
    const parts = [
      plural(moved.conversations, 'conversation', 'conversations'),
      plural(moved.bookings, 'demande ou inscription', 'demandes ou inscriptions'),
      plural(moved.referrals, 'résumé envoyé', 'résumés envoyés'),
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : 'aucune donnée enregistrée sous ce code';
  }

  private keep(code: string): void {
    this.code.set(code);
    try {
      localStorage.setItem(CODE_KEY, code);
    } catch {
      // Sans stockage, le code reste affiché pendant la visite.
    }
  }
}

function plural(count: number, one: string, many: string): string {
  if (!count) return '';
  return `${count} ${count > 1 ? many : one}`;
}
