import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonSelect, IonSelectOption } from '@ionic/angular';
import { AudioGuideService } from '../core/audio-guide.service';
import { Lang } from '../core/models';

@Component({
  selector: 'app-logo',
  imports: [RouterLink, IonButton, IonContent, IonSelect, IonSelectOption],
  templateUrl: './logo.page.html',
  styleUrls: ['./logo.page.scss'],
  standalone: true,
})
export class LogoPage implements OnInit, OnDestroy {
  private readonly audioGuide = inject(AudioGuideService);
  @Input() size = 200;
  readonly audioMessage = signal('');
  readonly logoSrc = 'assets/NEYA_logo_transparent.png';
  readonly languages = [
    { code: 'fr', label: 'Français' },
    { code: 'moore', label: 'Mooré' },
    { code: 'dioula', label: 'Dioula' },
  ];
  language = this.savedLanguage();

  ngOnInit(): void {
    this.readWelcome();
  }

  ngOnDestroy(): void {
    this.audioGuide.stop();
  }

  setLanguage(language: string | null | undefined): void {
    if (language !== 'fr' && language !== 'moore' && language !== 'dioula') return;
    this.language = language;
    localStorage.setItem('neya-language', language);
    if (language === 'fr') {
      this.readWelcome();
      return;
    }

    this.audioGuide.stop();
    this.audioMessage.set('Le guide vocal et les contenus sont disponibles en français pour le moment.');
  }

  readWelcome(): void {
    const language = this.language as Lang;
    const message = 'Bienvenue dans NEYA. Choisissez une langue, puis écoutez des vidéos d’information ou évaluez votre situation. Vous pouvez demander conseil à un professionnel de santé.';
    if (language !== 'fr') {
      this.audioMessage.set('Le guide vocal et les contenus sont disponibles en français pour le moment.');
      return;
    }

    this.audioMessage.set(
      this.audioGuide.speak(message, language)
        ? ''
        : 'La lecture vocale n’est pas disponible sur cet appareil.',
    );
  }

  private savedLanguage(): string {
    const value = localStorage.getItem('neya-language');
    return value === 'fr' || value === 'moore' || value === 'dioula' ? value : 'fr';
  }
}
