import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { BackendService } from '../core/backend.service';
import { LogoPage } from './logo.page';

describe('LogoPage', () => {
  let component: LogoPage;
  let fixture: ComponentFixture<LogoPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogoPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        // Pas d'appel réseau dans les tests : l'application tourne en mode démonstration.
        { provide: BackendService, useValue: { configured: false } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LogoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
