import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InfosPage } from './infos.page';

describe('InfosPage', () => {
  let component: InfosPage;
  let fixture: ComponentFixture<InfosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(InfosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
