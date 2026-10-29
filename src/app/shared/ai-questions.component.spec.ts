import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { provideRouter } from '@angular/router';
import { BackendService } from '../pages/core/backend.service';
import { OrientationResult } from '../pages/core/models';
import { AiQuestionsComponent } from './ai-questions.component';

describe('AiQuestionsComponent', () => {
  const result = {
    level: 2, title: 'Parlez-en à un professionnel', message: 'Un échange peut vous aider.',
    reasons: ['Vous avez plus de 40 ans.'], language: 'fr',
  } as OrientationResult;
  const askQuestion = vi.fn();

  function create() {
    const fixture = TestBed.createComponent(AiQuestionsComponent);
    fixture.componentRef.setInput('result', result);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(async () => {
    localStorage.clear();
    askQuestion.mockReset();
    await TestBed.configureTestingModule({
      imports: [AiQuestionsComponent],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: BackendService, useValue: { configured: true, askQuestion } },
      ],
    }).compileComponents();
  });

  it('answers a question and sends the previous exchanges for follow-up questions', async () => {
    askQuestion.mockResolvedValueOnce('Elle peut être un peu inconfortable.').mockResolvedValueOnce('Quelques minutes.');
    const component = create();

    await component.ask('Est-ce que la mammographie fait mal ?');
    expect(askQuestion).toHaveBeenCalledWith(result, 'fr', 'Est-ce que la mammographie fait mal ?', []);
    // L'exemple déjà posé disparaît des suggestions.
    expect(component.examples()).not.toContain('Est-ce que la mammographie fait mal ?');

    component.draft.set('Et ça dure combien de temps ?');
    await component.ask();
    expect(askQuestion).toHaveBeenLastCalledWith(result, 'fr', 'Et ça dure combien de temps ?', [
      { question: 'Est-ce que la mammographie fait mal ?', answer: 'Elle peut être un peu inconfortable.' },
    ]);
    expect(component.turns()).toHaveLength(2);
    expect(component.draft()).toBe('');
  });

  it('keeps the question and shows the error when the AI is unavailable', async () => {
    askQuestion.mockRejectedValue(new Error('Le service IA est momentanément indisponible.'));
    const component = create();
    component.draft.set('Une boule, c’est grave ?');
    await component.ask();
    expect(component.error()).toBe('Le service IA est momentanément indisponible.');
    expect(component.draft()).toBe('Une boule, c’est grave ?');
    expect(component.turns()).toHaveLength(0);
  });

  it('stops after ten questions', async () => {
    askQuestion.mockResolvedValue('Réponse.');
    const component = create();
    for (let i = 0; i < 11; i++) await component.ask(`Question ${i}`);
    expect(askQuestion).toHaveBeenCalledTimes(10);
    expect(component.remaining()).toBe(0);
  });
});
