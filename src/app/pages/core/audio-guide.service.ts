import { Injectable } from '@angular/core';
import { Lang } from './models';

@Injectable({ providedIn: 'root' })
export class AudioGuideService {
  canSpeak(language: Lang): boolean {
    return language === 'fr' && typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(text: string, language: Lang = 'fr'): boolean {
    if (!this.canSpeak(language)) return false;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
