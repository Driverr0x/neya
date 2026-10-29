import { Component, Input, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chatbubbleEllipsesOutline, volumeHighOutline, volumeMuteOutline } from 'ionicons/icons';
import { AudioGuideService } from '../core/audio-guide.service';
import { LANGUAGE_TILES, isLang } from '../core/data';
import { Lang, TalkingTile } from '../core/models';
import { TalkingTilesComponent } from '../../shared/talking-tiles.component';

/** Laisse l'animation du logo se terminer avant que les tuiles commencent à parler. */
const INTRO_MS = 1600;

@Component({
  selector: 'app-logo',
  imports: [RouterLink, IonButton, IonContent, IonIcon, TalkingTilesComponent],
  templateUrl: './logo.page.html',
  styleUrls: ['./logo.page.scss'],
  standalone: true,
})
export class LogoPage {
  private readonly router = inject(Router);
  readonly audio = inject(AudioGuideService);
  @Input() size = 150;
  readonly logoSrc = 'assets/NEYA_logo_transparent.png';
  readonly languageTiles = LANGUAGE_TILES;
  readonly tilesRunning = signal(false);
  language: Lang = this.savedLanguage();
  private introTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ chatbubbleEllipsesOutline, volumeHighOutline, volumeMuteOutline });
  }

  ionViewDidEnter(): void {
    this.introTimer = setTimeout(() => this.tilesRunning.set(true), INTRO_MS);
  }

  ionViewWillLeave(): void {
    clearTimeout(this.introTimer);
    this.tilesRunning.set(false);
  }

  chooseLanguage(tile: TalkingTile): void {
    if (!isLang(tile.id)) return;
    this.language = tile.id;
    localStorage.setItem('neya-language', tile.id);
    void this.router.navigateByUrl('/tabs/info');
  }

  private savedLanguage(): Lang {
    const value = localStorage.getItem('neya-language');
    return isLang(value) ? value : 'fr';
  }
}
