import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModePage } from './mode.page';

describe('ModePage', () => {
  let component: ModePage;
  let fixture: ComponentFixture<ModePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ModePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
