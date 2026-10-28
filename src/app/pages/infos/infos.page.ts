import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonIcon, IonButton
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { volumeHighOutline } from 'ionicons/icons';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LANG_LABEL, VIDEOS } from '../core/data';
import { Lang, Video } from '../core/models';
import { BrandHeaderComponent } from '../../shared/brand-header.component';
import { BackendService, PlatformVideo } from '../core/backend.service';
import { AudioGuideService } from '../core/audio-guide.service';

@Component({
  selector: 'app-info',
  standalone: true,
  imports: [
    RouterLink, BrandHeaderComponent, IonHeader, IonToolbar, IonTitle, IonContent, 
    IonIcon, IonButton
  ],
  templateUrl: './infos.page.html',
  styleUrls: ['./infos.page.scss'],
})
export class InfosPage {
  private readonly route = inject(ActivatedRoute);
  private readonly backend = inject(BackendService);
  private readonly audioGuide = inject(AudioGuideService);
  readonly platformVideos = signal<PlatformVideo[] | null>(null);
  readonly loadError = signal('');
  readonly audioMessage = signal('');
  readonly playingVideoId = signal<string | null>(null);
  readonly videoId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  lang: Lang = this.savedLanguage();
  label = LANG_LABEL;
  private activeVideoElement: HTMLVideoElement | null = null;
  video = computed(() => {
    const videos = this.platformVideos();
    const id = this.videoId();
    return videos
      ? videos.find((item) => item.id === id && item.language === this.lang)
      : VIDEOS.find((item) => item.id === id && item.lang === this.lang);
  });

  get filteredVideos(): Array<Video | PlatformVideo> {
    return (this.platformVideos() ?? VIDEOS).filter((video) =>
      this.platformVideos() ? (video as PlatformVideo).language === this.lang : video.lang === this.lang,
    );
  }

  readVideo(video: Video | PlatformVideo): void {
    const description = video.description;
    const message = `${video.title}. ${description}`;
    this.activeVideoElement?.pause();
    this.audioMessage.set(
      this.audioGuide.speak(message, this.lang)
        ? ''
        : 'Le guide vocal est disponible en français sur un appareil compatible.',
    );
  }

  onVideoPlay(id: string, event: Event): void {
    const element = event.currentTarget;
    if (!(element instanceof HTMLVideoElement)) return;

    if (this.activeVideoElement && this.activeVideoElement !== element) {
      this.activeVideoElement.pause();
    }
    this.activeVideoElement = element;
    this.playingVideoId.set(id);
    this.audioGuide.stop();
    this.audioMessage.set('');
  }

  onVideoStopped(event: Event): void {
    if (this.activeVideoElement !== event.currentTarget) return;
    this.activeVideoElement = null;
    this.playingVideoId.set(null);
  }

  constructor() {
    addIcons({ volumeHighOutline });
    void this.loadVideos();
  }

  private savedLanguage(): Lang {
    const value = localStorage.getItem('neya-language');
    return value === 'fr' || value === 'moore' || value === 'dioula' ? value : 'fr';
  }

  private async loadVideos(): Promise<void> {
    if (!this.backend.configured) return;
    try {
      await this.backend.ensureVisitorSession();
      this.platformVideos.set(await this.backend.browseVideos());
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Impossible de charger les vidéos.');
    }
  }
}