import { Injectable, inject } from '@angular/core';
import { StoreService } from './store.service';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly store = inject(StoreService);

  active() {
    return this.store.result();
  }

  message(): string {
    return 'Pensez à contacter un professionnel de santé si vous avez une question ou une inquiétude.';
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
