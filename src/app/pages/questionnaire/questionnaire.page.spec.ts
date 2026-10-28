import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuestionnairePage } from './questionnaire.page';

describe('QuestionnairePage', () => {
  let component: QuestionnairePage;
  let fixture: ComponentFixture<QuestionnairePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(QuestionnairePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
