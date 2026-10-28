import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonButton, IonIcon, IonProgressBar, IonSpinner, IonButtons 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as icons from 'ionicons/icons';
import { Answers, Question } from '../core/models';
import { QUESTIONS, LANG_LABEL, SPECIALTY_LABEL, VIDEOS } from '../core/data';
import { OrientationService } from '../core/orientation.service';
import { ResultInterpretationService } from '../core/result-interpretation.service';
import { StoreService } from '../core/store.service';
import { BrandHeaderComponent } from '../../shared/brand-header.component';
import { AudioGuideService } from '../core/audio-guide.service';

@Component({
  selector: 'app-questionnaire',
  standalone: true,
  imports: [
    RouterLink, BrandHeaderComponent, IonHeader, IonToolbar, IonTitle, IonContent, 
    IonButton, IonIcon, IonProgressBar, IonSpinner, IonButtons
  ],
  templateUrl: './questionnaire.page.html',
  styleUrls: ['./questionnaire.page.scss'],
})
export class QuestionnairePage {
  store = inject(StoreService);
  private orient = inject(OrientationService);
  private readonly audioGuide = inject(AudioGuideService);
  readonly interpretation = inject(ResultInterpretationService);
  
  spec = SPECIALTY_LABEL; 
  lang = LANG_LABEL;
  
  answers = signal<Answers>({});
  step = signal(0);
  loading = signal(false);
  aiConsent = signal(false);
  aiLoading = signal(false);
  aiError = signal('');
  audioMessage = signal('');

  /** Questionnaire adaptatif : les questions non pertinentes sont retirées selon les réponses. */
  questions = computed(() => QUESTIONS.filter(q => !q.showIf || q.showIf(this.answers())));
  q = computed(() => this.questions()[this.step()]);

  constructor() { 
    addIcons(icons); 
  }

  isSel(q: Question, v: string | number) {
    const current = this.answers()[q.id];
    return q.multi
      ? Array.isArray(current) && current.includes(String(v))
      : current === v;
  }

  pick(q: Question, v: string | number) {
    this.answers.update(a => {
      if (!q.multi) return { ...a, [q.id]: v };
      const current = a[q.id];
      let cur = Array.isArray(current) ? [...current] : [];
      const value = String(v);
      if (v === 'none') cur = cur.includes('none') ? [] : ['none'];
      else { 
        cur = cur.filter(x => x !== 'none'); 
        cur = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value]; 
      }
      return { ...a, [q.id]: cur };
    });
    if (!q.multi) this.next();
  }

  readQuestion(): void {
    const current = this.q();
    if (!current) return;
    const choices = current.options.map((option, index) => `Choix ${index + 1} : ${option.label}`).join('. ');
    const language = this.selectedLanguage();
    this.audioMessage.set(
      this.audioGuide.speak(`${current.title}. ${current.hint ?? ''} ${choices}`, language)
        ? ''
        : 'Le guide vocal est disponible en français sur un appareil compatible.',
    );
  }

  readResult(): void {
    const result = this.store.result();
    if (!result) return;
    const reasons = result.reasons.join('. ');
    const language = this.selectedLanguage();
    this.audioMessage.set(
      this.audioGuide.speak(`${result.title}. ${result.message}. ${result.simpleExplanation ?? ''}. ${reasons}`, language)
        ? ''
        : 'Le guide vocal est disponible en français sur un appareil compatible.',
    );
  }

  async next() {
    if (this.step() < this.questions().length - 1) { 
      this.step.update(s => s + 1); 
      return; 
    }
    this.loading.set(true);
    try {
      const a = this.answers();
      this.store.setAnswers(a);
      const r = await this.orient.orient(a);
      const simpleExplanation = await this.interpretation.interpret(r);
      this.store.setResult({ ...r, simpleExplanation, at: Date.now() });
      this.store.markReminded();
    } finally {
      this.loading.set(false);
    }
  }

  async requestAiExplanation(): Promise<void> {
    const result = this.store.result();
    if (!result || !this.aiConsent() || !this.interpretation.aiAvailable) return;
    this.aiLoading.set(true);
    this.aiError.set('');
    try {
      const simpleExplanation = await this.interpretation.interpretWithAi(result, result.language);
      this.store.setResult({
        ...result,
        simpleExplanation,
        explanationSource: 'ai',
      });
    } catch (error) {
      this.aiError.set(
        error instanceof Error
          ? `L’explication IA n’a pas pu être générée : ${error.message}`
          : 'L’explication IA n’a pas pu être générée. Réessayez plus tard.',
      );
    } finally {
      this.aiLoading.set(false);
    }
  }

  restart() { 
    this.answers.set({}); 
    this.step.set(0); 
    this.store.setResult(null); 
  }

  videoTitle(id: string) { 
    return VIDEOS.find(v => v.id === id)?.title ?? ''; 
  }

  private selectedLanguage(): 'fr' | 'moore' | 'dioula' {
    const value = localStorage.getItem('neya-language');
    return value === 'moore' || value === 'dioula' ? value : 'fr';
  }
}