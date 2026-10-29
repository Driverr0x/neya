import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonIcon, IonButton
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle, cloudDownloadOutline, cloudOfflineOutline, closeOutline, trashOutline, volumeHighOutline,
} from 'ionicons/icons';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LANG_LABEL, VIDEOS, isLang } from '../core/data';
import { Lang, Video } from '../core/models';
import { BrandHeaderComponent } from '../../shared/brand-header.component';
import { BackendService, PlatformVideo } from '../core/backend.service';
import { AudioGuideService } from '../core/audio-guide.service';
import { OfflineVideoService, SavedVideo, formatSize } from '../core/offline-video.service';
import { StoreService } from '../core/store.service';

/** Où la vidéo peut être lue : intégrée à l'appli, enregistrée dans le téléphone, en ligne seulement, ou pas du tout. */
export type VideoAvailability = 'builtin' | 'saved' | 'online' | 'unavailable';

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
  readonly audioGuide = inject(AudioGuideService);
  readonly offline = inject(OfflineVideoService);
  readonly store = inject(StoreService);
  /** Adresses locales des vidéos enregistrées (identifiant → blob:). */
  private readonly localSrc = signal<Record<string, string>>({});
  readonly videoErrors = signal<Record<string, string>>({});
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
  /** Vidéos NEYA intégrées (toujours là, même hors connexion), puis celles publiées par les médecins. */
  readonly allVideos = computed<Video[]>(() => {
    const online = (this.platformVideos() ?? []).map((video) => ({ ...video, author: video.author ?? 'Professionnel de santé' }));
    const known = new Set([...VIDEOS, ...online].map((video) => video.id));
    // Sans connexion la liste du serveur manque : les vidéos enregistrées s'affichent quand même.
    const savedOnly = this.offline.savedList().filter((video) => !known.has(video.id)).map(savedToVideo);
    return [...VIDEOS, ...online, ...savedOnly];
  });
  /** Une vidéo ouverte par un lien (résultat du questionnaire…) s'affiche quelle que soit la langue choisie. */
  video = computed(() => this.allVideos().find((item) => item.id === this.videoId()));
  private readonly inChosenLanguage = computed(() => this.allVideos().filter((video) => video.lang === this.lang));
  /** Pas encore de vidéo dans la langue choisie : on propose celles en français plutôt qu'un écran vide. */
  readonly showingFallback = computed(() => this.lang !== 'fr' && this.inChosenLanguage().length === 0);
  readonly feedVideos = computed(() => {
    const videos = this.showingFallback() ? this.allVideos().filter((video) => video.lang === 'fr') : this.inChosenLanguage();
    if (this.store.online()) return videos;
    // Hors connexion : d'abord ce qui peut se regarder.
    return [...videos].sort((a, b) => Number(this.availability(a) === 'unavailable') - Number(this.availability(b) === 'unavailable'));
  });
  readonly savedSummary = computed(() => {
    const count = this.offline.savedList().length;
    if (!count) return '';
    return `${count} vidéo${count > 1 ? 's' : ''} enregistrée${count > 1 ? 's' : ''} sur ce téléphone · ${formatSize(this.offline.totalBytes())}`;
  });

  availability(video: Video): VideoAvailability {
    if (this.offline.isBuiltIn(video)) return 'builtin';
    if (this.offline.isSaved(video.id)) return 'saved';
    return this.store.online() && video.src ? 'online' : 'unavailable';
  }

  /** Le fichier enregistré passe avant le lien en ligne : pas de données consommées pour le revoir. */
  srcFor(video: Video): string {
    const local = this.localSrc()[video.id];
    if (local) return local;
    return this.availability(video) === 'unavailable' ? '' : video.src;
  }

  progressLabel(id: string): string {
    const value = this.offline.progress()[id];
    return value === null || value === undefined ? 'Téléchargement…' : `Téléchargement… ${value} %`;
  }

  savedSize(id: string): string {
    const saved = this.offline.saved()[id];
    return saved ? formatSize(saved.sizeBytes) : '';
  }

  async download(video: Video): Promise<void> {
    this.setVideoError(video.id, '');
    try {
      await this.offline.download(video);
    } catch (error) {
      this.setVideoError(video.id, error instanceof Error ? error.message : 'Le téléchargement a échoué.');
    }
  }

  async removeDownload(video: Video): Promise<void> {
    this.localSrc.update(({ [video.id]: _, ...rest }) => rest);
    await this.offline.remove(video.id);
  }

  private setVideoError(id: string, message: string): void {
    this.videoErrors.update((current) => ({ ...current, [id]: message }));
  }

  meta(video: Video): string {
    return [video.author, video.duration].filter(Boolean).join(' · ');
  }

  readVideo(video: Video): void {
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
    addIcons({ checkmarkCircle, cloudDownloadOutline, cloudOfflineOutline, closeOutline, trashOutline, volumeHighOutline });
    // Prépare l'adresse locale de chaque vidéo enregistrée (au chargement et après chaque téléchargement).
    effect(() => {
      for (const video of this.offline.savedList()) {
        if (this.localSrc()[video.id]) continue;
        void this.offline.localUrl(video.id).then((url) => {
          if (url) this.localSrc.update((current) => ({ ...current, [video.id]: url }));
        });
      }
    });
    // Retour de la connexion après un échec : on recharge la liste des vidéos des médecins.
    effect(() => {
      if (this.store.online() && this.loadError()) void this.loadVideos();
    });
    void this.loadVideos();
  }

  private savedLanguage(): Lang {
    const value = localStorage.getItem('neya-language');
    return isLang(value) ? value : 'fr';
  }

  private async loadVideos(): Promise<void> {
    if (!this.backend.configured) return;
    try {
      await this.backend.ensureVisitorSession();
      this.platformVideos.set(await this.backend.browseVideos());
      this.loadError.set('');
    } catch {
      // Les vidéos NEYA et celles enregistrées restent disponibles : on signale seulement celles des médecins.
      this.loadError.set(
        this.store.online()
          ? 'Les vidéos des médecins n’ont pas pu être chargées. Vérifiez votre connexion.'
          : 'Hors connexion : vous pouvez regarder les vidéos marquées « Hors ligne ».',
      );
    }
  }
}

function savedToVideo(video: SavedVideo): Video {
  return { ...video, src: '' };
}
