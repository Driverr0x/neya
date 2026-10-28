import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StructuresPage } from './structures.page';

describe('StructuresPage', () => {
  let component: StructuresPage;
  let fixture: ComponentFixture<StructuresPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(StructuresPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
