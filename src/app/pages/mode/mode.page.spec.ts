import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { ModePage } from './mode.page';

describe('ModePage', () => {
  let component: ModePage;
  let fixture: ComponentFixture<ModePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModePage],
      providers: [provideIonicAngular()],
    }).compileComponents();
    fixture = TestBed.createComponent(ModePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
