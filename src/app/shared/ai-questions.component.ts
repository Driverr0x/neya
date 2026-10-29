import { Component, computed, inject, input, signal } from '@angular/core';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chatbubbleEllipsesOutline, cloudOfflineOutline, lockClosedOutline, sendOutline, volumeHighOutline } from 'ionicons/icons';
import { AiTurn, BackendService } from '../pages/core/backend.service';
import { AudioGuideService } from '../pages/core/audio-guide.service';
import { OrientationResult } from '../pages/core/models';
import { StoreService } from '../pages/core/store.service';

/** Au-delà, on invite à poursuivre avec un professionnel (et on limite le coût du service IA). */
const MAX_QUESTIONS = 10;

const EXAMPLES: Record<'fr' | 'en', string[]> = {
  fr: [
    'Est-ce que la mammographie fait mal ?',
    'Une boule, c’est forcément grave ?',
    'Comment faire l’autopalpation ?',
    'Comment se passe la consultation ?',
  ],
  en: [
    'Does a mammogram hurt?',
    'Is a lump always serious?',
    'How do I check my breasts?',
    'What happens during the consultation?',
  ],
};

/**
 * En ligne, après l'évaluation : la femme pose ses questions en langage libre et l'IA répond simplement,
 * sans diagnostic. Les échanges restent sur l'écran : ils ne sont enregistrés ni par NEYA ni par l'hôpital.
 */
@Component({
  selector: 'app-ai-questions',
  standalone: true,
  imports: [IonButton, IonIcon, IonSpinner],
  templateUrl: './ai-questions.component.html',
  styleUrls: ['./ai-questions.component.scss'],
})
export class AiQuestionsComponent {
  readonly result = input.required<OrientationResult>();

  readonly backend = inject(BackendService);
  readonly store = inject(StoreService);
  readonly audioGuide = inject(AudioGuideService);

  readonly turns = signal<AiTurn[]>([]);
  readonly draft = signal('');
  readonly asking = signal('');
  readonly error = signal('');

  readonly english = computed(() => this.result().language === 'en');
  readonly examples = computed(() => EXAMPLES[this.english() ? 'en' : 'fr']
    .filter((example) => !this.turns().some((turn) => turn.question === example)));
  readonly remaining = computed(() => MAX_QUESTIONS - this.turns().length);

  constructor() {
    addIcons({ chatbubbleEllipsesOutline, cloudOfflineOutline, lockClosedOutline, sendOutline, volumeHighOutline });
  }

  async ask(text = this.draft()): Promise<void> {
    const question = text.trim();
    if (!question || this.asking() || this.remaining() <= 0) return;
    if (question.length > 400) return this.error.set('Votre question est trop longue : 400 caractères au maximum.');
    this.asking.set(question);
    this.error.set('');
    try {
      const result = this.result();
      const answer = await this.backend.askQuestion(result, result.language, question, this.turns());
      this.turns.update((turns) => [...turns, { question, answer }]);
      this.draft.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'La réponse n’a pas pu être obtenue. Réessayez.');
    } finally {
      this.asking.set('');
    }
  }

  /** Les réponses sont en français, sauf pour une utilisatrice anglophone. */
  listen(answer: string): void {
    this.audioGuide.speak(answer, 'fr');
  }
}
