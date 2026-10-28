import { Injectable, computed, signal } from '@angular/core';
import { Answers, ChatMessage, OrientationResult, Professional, QueueItem } from './models';

interface Submission {
  kind: QueueItem['kind'];
  name?: string;
  proName?: string;
  proId?: string;
  structureId?: string;
  slot?: string;
  mode?: QueueItem['mode'];
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly _online = signal(true);
  private readonly _answers = signal<Answers>({});
  private readonly _result = signal<OrientationResult | null>(null);
  private readonly _queue = signal<QueueItem[]>([]);
  private readonly _messages = signal<ChatMessage[]>([]);
  private lastRemindedAt = 0;
  private nextId = 0;

  readonly online = this._online.asReadonly();
  readonly answers = this._answers.asReadonly();
  readonly result = this._result.asReadonly();
  readonly queue = this._queue.asReadonly();
  readonly messages = this._messages.asReadonly();
  readonly pendingCount = computed(
    () => this._queue().filter((item) => item.status === 'pending').length,
  );

  onSent?: (count: number) => void | Promise<void>;

  setAnswers(answers: Answers): void {
    this._answers.set(answers);
  }

  setResult(result: OrientationResult | null): void {
    this._result.set(result);
  }

  toggleOffline(): void {
    this._online.update((online) => !online);
    if (this._online() && this.pendingCount() > 0) {
      const count = this.pendingCount();
      this._queue.update((items) =>
        items.map((item) =>
          item.status === 'pending' ? { ...item, status: 'sent' } : item,
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
    this.lastRemindedAt = Date.now();
  }

  wasRemindedRecently(intervalMs: number): boolean {
    return Date.now() - this.lastRemindedAt < intervalMs;
  }

  submit(submission: Submission): QueueItem {
    const item: QueueItem = {
      ...submission,
      id: `request-${Date.now()}-${++this.nextId}`,
      status: this._online() ? 'sent' : 'pending',
    };
    this._queue.update((items) => [item, ...items]);
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
