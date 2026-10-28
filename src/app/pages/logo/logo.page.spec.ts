import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LogoPage } from './logo.page';

describe('LogoPage', () => {
  let component: LogoPage;
  let fixture: ComponentFixture<LogoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LogoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
