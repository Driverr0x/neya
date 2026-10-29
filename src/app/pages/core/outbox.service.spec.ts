import { TestBed } from '@angular/core/testing';
import { AlreadyRegisteredError, BackendService } from './backend.service';
import { BookingPayload } from './models';
import { OutboxService } from './outbox.service';
import { StoreService } from './store.service';

describe('OutboxService', () => {
  const booking: BookingPayload = {
    structureId: 'structure-1',
    kind: 'appointment',
    fullName: 'Awa (test)',
    phone: '+226 70 00 00 00',
    slotLabel: 'mardi matin',
  };
  let store: StoreService;
  let outbox: OutboxService;
  let submitBooking: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    submitBooking = vi.fn().mockResolvedValue('booking-id');
    TestBed.configureTestingModule({
      providers: [{ provide: BackendService, useValue: { configured: true, submitBooking } }],
    });
    store = TestBed.inject(StoreService);
    outbox = TestBed.inject(OutboxService);
    outbox.start();
  });

  it('keeps an offline request on the phone and sends it when the connection returns', async () => {
    store.setOnline(false);
    store.submit({ kind: 'appointment', proName: 'Centre (test)', slot: 'mardi matin', booking });
    expect(store.pendingBookings()).toHaveLength(1);
    expect(submitBooking).not.toHaveBeenCalled();
    // Survit à un redémarrage : la file est relue depuis le stockage du téléphone.
    expect(JSON.parse(localStorage.getItem('neya-state') ?? '{}').queue).toHaveLength(1);

    store.setOnline(true);
    await vi.waitFor(() => expect(store.pendingBookings()).toHaveLength(0));

    expect(submitBooking).toHaveBeenCalledWith(booking);
    // Une fois envoyée, nom et téléphone ne restent pas sur le téléphone.
    expect(store.queue()[0]).toMatchObject({ status: 'sent' });
    expect(store.queue()[0].booking).toBeUndefined();
  });

  it('treats a request that already reached the server as sent', async () => {
    submitBooking.mockRejectedValueOnce(new AlreadyRegisteredError());
    store.setOnline(false);
    store.submit({ kind: 'appointment', booking: { ...booking, kind: 'screening', screeningEventId: 'event-1' } });

    store.setOnline(true);
    await vi.waitFor(() => expect(store.pendingBookings()).toHaveLength(0));
  });

  it('keeps the request and shows the error when sending fails', async () => {
    submitBooking.mockRejectedValueOnce(new Error('Réseau instable'));
    store.setOnline(false);
    store.submit({ kind: 'appointment', booking });

    store.setOnline(true);
    await vi.waitFor(() => expect(store.queue()[0].error).toBe('Réseau instable'));
    expect(store.pendingBookings()).toHaveLength(1);
  });
});
