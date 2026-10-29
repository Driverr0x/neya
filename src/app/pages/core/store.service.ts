import { Injectable, computed, signal } from '@angular/core';
import { Answers, BookingPayload, ChatMessage, OrientationResult, Professional, QueueItem } from './models';

/** Ce qui doit survivre à un redémarrage : résultat (rappels), réponses, demandes en attente. */
interface PersistedState {
  answers?: Answers;
  result?: OrientationResult | null;
  queue?: QueueItem[];
  lastRemindedAt?: number;
}

const STATE_KEY = 'neya-state';

function readState(): PersistedState {
  try {
    const value = JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

interface Submission {
  kind: QueueItem['kind'];
  name?: string;
  proName?: string;
  proId?: string;
  structureId?: string;
  slot?: string;
  mode?: QueueItem['mode'];
  booking?: BookingPayload;
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly _online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  private readonly saved = readState();
  private readonly _answers = signal<Answers>(this.saved.answers ?? {});
  private readonly _result = signal<OrientationResult | null>(this.saved.result ?? null);
  private readonly _queue = signal<QueueItem[]>(this.saved.queue ?? []);
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _lastRemindedAt = signal(this.saved.lastRemindedAt ?? 0);
  private nextId = 0;

  readonly online = this._online.asReadonly();
  readonly answers = this._answers.asReadonly();
  readonly result = this._result.asReadonly();
  readonly queue = this._queue.asReadonly();
  readonly messages = this._messages.asReadonly();
  readonly pendingCount = computed(
    () => this._queue().filter((item) => item.status === 'pending').length,
  );

  /** Demandes réelles (Supabase) encore à envoyer. */
  readonly pendingBookings = computed(() => this._queue().filter((item) => item.status === 'pending' && item.booking));

  onSent?: (count: number) => void | Promise<void>;
  /** Appelé au retour de la connexion, pour envoyer les demandes réelles en attente. */
  onReconnect?: () => void;

  constructor() {
    // Suit la vraie connexion du téléphone ; le bouton de l'en-tête permet en plus de simuler le mode hors ligne.
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));
  }

  setOnline(online: boolean): void {
    if (this._online() !== online) this.toggleOffline();
  }

  setAnswers(answers: Answers): void {
    this._answers.set(answers);
    this.persist();
  }

  setResult(result: OrientationResult | null): void {
    this._result.set(result);
    this.persist();
  }

  toggleOffline(): void {
    this._online.update((online) => !online);
    if (!this._online()) return;
    // Les demandes réelles partent par le serveur ; seules celles de démonstration sont validées ici.
    this.onReconnect?.();
    const demoPending = this._queue().filter((item) => item.status === 'pending' && !item.booking).length;
    if (demoPending > 0) {
      const count = demoPending;
      this.updateQueue((items) =>
        items.map((item) =>
          item.status === 'pending' && !item.booking ? { ...item, status: 'sent' } : item,
        ),
      );
      this._messages.update((messages) =>
        messages.map((message) =>
          message.status === 'pending' ? { ...message, status: 'sent' } : message,
        ),
      );
      void this.onSent?.(count);
    }
  }

  markReminded(): void {
    this._lastRemindedAt.set(Date.now());
    this.persist();
  }

  wasRemindedRecently(intervalMs: number): boolean {
    return Date.now() - this._lastRemindedAt() < intervalMs;
  }

  /** Demande réelle envoyée : on retire nom et téléphone du téléphone, ils sont maintenant sur le serveur. */
  markBookingSent(id: string): void {
    this.updateQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, status: 'sent', booking: undefined, error: undefined } : item)),
    );
  }

  markBookingFailed(id: string, error: string): void {
    this.updateQueue((items) => items.map((item) => (item.id === id ? { ...item, error } : item)));
  }

  removeQueueItem(id: string): void {
    this.updateQueue((items) => items.filter((item) => item.id !== id));
  }

  private updateQueue(change: (items: QueueItem[]) => QueueItem[]): void {
    this._queue.update(change);
    this.persist();
  }

  private persist(): void {
    const state: PersistedState = {
      answers: this._answers(),
      result: this._result(),
      queue: this._queue().slice(0, 30),
      lastRemindedAt: this._lastRemindedAt(),
    };
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      // Stockage indisponible (navigation privée) : l'application marche, sans mémoire entre deux visites.
    }
  }

  submit(submission: Submission): QueueItem {
    const item: QueueItem = {
      ...submission,
      id: `request-${Date.now()}-${++this.nextId}`,
      status: this._online() ? 'sent' : 'pending',
    };
    this.updateQueue((items) => [item, ...items]);
    return item;
  }

  sendMessage(professional: Professional, content: string): ChatMessage {
    return this.createMessage(professional, 'text', content);
  }

  sendAudioMessage(professional: Professional, audioUrl: string): ChatMessage {
    return this.createMessage(professional, 'audio', 'Message vocal', audioUrl);
  }

  private createMessage(
    professional: Professional,
    type: ChatMessage['type'],
    content: string,
    audioUrl?: string,
  ): ChatMessage {
    const item = this.submit({
      kind: 'message',
      proId: professional.id,
      proName: professional.name,
      mode: 'remote',
    });
    const message: ChatMessage = {
      id: item.id,
      proId: professional.id,
      type,
      content,
      audioUrl,
      createdAt: new Date(),
      status: item.status,
    };
    this._messages.update((messages) => [...messages, message]);
    return message;
  }
}
