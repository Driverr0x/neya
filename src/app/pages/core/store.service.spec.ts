import { PROFESSIONALS } from './data';
import { StoreService } from './store.service';

describe('StoreService messaging', () => {
  let store: StoreService;

  beforeEach(() => {
    store = new StoreService();
  });

  it('stores messages and marks offline messages sent when connection returns', () => {
    const professional = PROFESSIONALS.find((item) => item.id === 'pro-aminata');
    if (!professional) {
      throw new Error('Expected the sample professional to exist');
    }

    const sent = store.sendMessage(professional, 'Bonjour');
    expect(sent.status).toBe('sent');
    expect(sent.type).toBe('text');
    expect(store.queue()[0]).toMatchObject({
      kind: 'message',
      proId: professional.id,
      status: 'sent',
    });

    store.toggleOffline();
    const pending = store.sendMessage(professional, 'Je vous écris hors ligne');
    expect(pending.status).toBe('pending');

    store.toggleOffline();
    expect(store.messages().map((message) => message.status)).toEqual(['sent', 'sent']);
    expect(store.pendingCount()).toBe(0);
  });

  it('stores audio messages with their playback URL and queues them for delivery', () => {
    const professional = PROFESSIONALS.find((item) => item.id === 'pro-aminata');
    if (!professional) {
      throw new Error('Expected the sample professional to exist');
    }

    const audioUrl = 'blob:audio-message';
    const message = store.sendAudioMessage(professional, audioUrl);

    expect(message).toMatchObject({
      type: 'audio',
      content: 'Message vocal',
      audioUrl,
      status: 'sent',
    });
    expect(store.queue()[0]).toMatchObject({
      kind: 'message',
      proId: professional.id,
      status: 'sent',
    });
  });
});
