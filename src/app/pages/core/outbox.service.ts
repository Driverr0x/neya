import { Injectable, inject } from '@angular/core';
import { AlreadyRegisteredError, BackendService } from './backend.service';
import { StoreService } from './store.service';

/**
 * Envoie à Supabase les demandes faites sans connexion (rendez-vous, inscriptions aux dépistages).
 * Elles attendent dans la file du StoreService, enregistrée sur le téléphone, et partent dès que la
 * connexion revient ou au prochain lancement de l'application.
 */
@Injectable({ providedIn: 'root' })
export class OutboxService {
  private readonly store = inject(StoreService);
  private readonly backend = inject(BackendService);
  private flushing = false;

  /** À appeler une fois au démarrage de l'espace visiteuse. */
  start(): void {
    this.store.onReconnect = () => void this.flush();
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing || !this.backend.configured || !this.store.online()) return;
    this.flushing = true;
    let sent = 0;
    try {
      for (const item of this.store.pendingBookings()) {
        if (!this.store.online() || !item.booking) break;
        try {
          await this.backend.submitBooking(item.booking);
          this.store.markBookingSent(item.id);
          sent++;
        } catch (error) {
          if (error instanceof AlreadyRegisteredError) {
            // Déjà arrivée sur le serveur (envoi précédent interrompu) : rien à renvoyer.
            this.store.markBookingSent(item.id);
            sent++;
            continue;
          }
          this.store.markBookingFailed(
            item.id,
            error instanceof Error ? error.message : 'Envoi impossible pour le moment.',
          );
          // Le réseau est sans doute encore instable : on réessaiera au prochain retour de connexion.
          break;
        }
      }
    } finally {
      this.flushing = false;
    }
    if (sent) await this.store.onSent?.(sent);
  }
}
