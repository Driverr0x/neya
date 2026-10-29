import { Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Lang } from './models';

const VOICE_LANG: Partial<Record<Lang, string>> = { fr: 'fr-FR', en: 'en-US' };
const SOUND_KEY = 'neya-sound';
/** Formats acceptés pour les enregistrements, essayés dans cet ordre (un fichier absent n'est essayé qu'une fois). */
const AUDIO_EXTENSIONS = ['ogg', 'mp4', 'm4a', 'mp3'];

@Injectable({ providedIn: 'root' })
export class AudioGuideService {
  /** Le navigateur refuse le son tant que la personne n'a pas touché l'écran une première fois. */
  readonly blocked = signal(false);
  /** Choix de la personne : avec ou sans le son. Retenu d'une visite à l'autre. */
  readonly enabled = signal(this.savedPreference());
  private readonly missingAudio = new Set<string>();
  private finishCurrent?: () => void;
  /** Incrémenté à chaque arrêt : une lecture lancée avant ne doit plus démarrer après. */
  private generation = 0;

  constructor() {
    // Quitter un écran fait taire tout ce qui s'y disait.
    inject(Router).events
      .pipe(filter((event) => event instanceof NavigationStart))
      .subscribe(() => this.stop());
  }

  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
    try {
      localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
    } catch {
      // Le choix reste valable pour la session même sans stockage.
    }
    // Le toucher sur le bouton autorise aussi le son côté navigateur.
    if (enabled) this.blocked.set(false);
    else this.stop();
  }

  canSpeak(language: Lang): boolean {
    return this.enabled() && language === 'fr' && typeof window !== 'undefined' && 'speechSynthesis' in window;
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

  /**
   * Joue assets/audio/<audio> (.ogg, .mp4, .m4a ou .mp3) ; si l'enregistrement n'existe pas encore, lit le texte de secours
   * par synthèse vocale. La promesse se résout à la fin de la lecture (ou immédiatement sans son).
   */
  async say(audio: string, fallback?: { text: string; lang: Lang }): Promise<void> {
    this.stop();
    if (!this.enabled()) return;
    const generation = this.generation;
    for (const extension of AUDIO_EXTENSIONS) {
      const src = `assets/audio/${audio}.${extension}`;
      if (this.missingAudio.has(src)) continue;
      if (await this.playRecording(src)) return;
      if (generation !== this.generation) return;
    }
    if (fallback && generation === this.generation) await this.speakUntilEnd(fallback.text, fallback.lang);
  }

  /** À appeler depuis un geste de la personne pour autoriser le son. */
  unlock(): void {
    this.blocked.set(false);
  }

  stop(): void {
    this.generation++;
    this.finishCurrent?.();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /** Résout `false` si le fichier est introuvable, pour basculer sur la synthèse vocale. */
  private playRecording(src: string): Promise<boolean> {
    return new Promise((resolve) => {
      const audio = new Audio(src);
      let settled = false;
      const finish = (played: boolean) => {
        if (settled) return;
        settled = true;
        audio.pause();
        resolve(played);
      };
      this.finishCurrent = () => finish(true);
      audio.onended = () => finish(true);
      audio.onerror = () => {
        this.missingAudio.add(src);
        finish(false);
      };
      audio.play().then(
        () => this.blocked.set(false),
        (error: unknown) => {
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            this.blocked.set(true);
            finish(true);
          } else {
            this.missingAudio.add(src);
            finish(false);
          }
        },
      );
    });
  }

  private speakUntilEnd(text: string, language: Lang): Promise<void> {
    const voiceLang = VOICE_LANG[language];
    if (!voiceLang || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceLang;
      utterance.rate = 0.9;
      utterance.onend = finish;
      utterance.onerror = (event) => {
        if (event.error === 'not-allowed') this.blocked.set(true);
        finish();
      };
      this.finishCurrent = finish;
      window.speechSynthesis.speak(utterance);
    });
  }

  private savedPreference(): boolean {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch {
      return true;
    }
  }
}
