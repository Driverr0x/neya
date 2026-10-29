import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { BackendService } from '../core/backend.service';
import { RecoveryPage } from './recovery.page';

describe('RecoveryPage', () => {
  const createRecoveryCode = vi.fn();
  const redeemRecoveryCode = vi.fn();

  beforeEach(async () => {
    localStorage.clear();
    createRecoveryCode.mockReset().mockResolvedValue('NEYA-AAAA-BBBB-CCCC-DDDD');
    redeemRecoveryCode.mockReset();
    await TestBed.configureTestingModule({
      imports: [RecoveryPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: BackendService, useValue: { configured: true, createRecoveryCode, redeemRecoveryCode } },
      ],
    }).compileComponents();
  });

  it('creates a code and keeps it on the phone', async () => {
    const page = TestBed.createComponent(RecoveryPage).componentInstance;
    await page.createCode();
    expect(page.code()).toBe('NEYA-AAAA-BBBB-CCCC-DDDD');
    expect(localStorage.getItem('neya-recovery-code')).toBe('NEYA-AAAA-BBBB-CCCC-DDDD');
  });

  it('recovers data and shows the new code that replaces the used one', async () => {
    redeemRecoveryCode.mockResolvedValue({
      moved: { conversations: 2, bookings: 1, referrals: 0 },
      code: 'NEYA-EEEE-FFFF-GGGG-HHHH',
    });
    const page = TestBed.createComponent(RecoveryPage).componentInstance;
    page.typedCode.set('neya aaaa bbbb cccc dddd');
    await page.redeem();
    expect(redeemRecoveryCode).toHaveBeenCalledWith('neya aaaa bbbb cccc dddd');
    expect(page.code()).toBe('NEYA-EEEE-FFFF-GGGG-HHHH');
    expect(page.recoveredSummary(page.recovered()!)).toBe('2 conversations, 1 demande ou inscription');
  });

  it('shows why a code was refused', async () => {
    redeemRecoveryCode.mockRejectedValue(new Error('Code introuvable.'));
    const page = TestBed.createComponent(RecoveryPage).componentInstance;
    page.typedCode.set('NEYA-2222-3333-4444-5555');
    await page.redeem();
    expect(page.redeemError()).toBe('Code introuvable.');
    expect(page.recovered()).toBeNull();
  });
});
