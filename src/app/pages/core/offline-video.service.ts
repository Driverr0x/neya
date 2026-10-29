import { Injectable, computed, signal } from '@angular/core';
import { Video } from './models';

/** Ce qu'il faut garder pour afficher une vidéo enregistrée sans connexion. */
export interface SavedVideo {
  id: string;
  title: string;
  author: string;
  duration: string;
  lang: Video['lang'];
  description: string;
  sizeBytes: number;
  savedAt: string;
}

const CACHE_NAME = 'neya-videos-hors-ligne-v1';
const STORAGE_KEY = 'neya-offline-videos';

/**
 * Enregistre des vidéos dans le téléphone pour les regarder sans connexion.
 *
 * Le fichier va dans le Cache Storage (disponible dans les navigateurs et la WebView Capacitor) sous une
 * adresse stable par vidéo : les liens Supabase sont signés et changent à chaque chargement. La liste des
 * vidéos enregistrées (titre, langue…) est gardée à part pour pouvoir l'afficher hors connexion.
 */
@Injectable({ providedIn: 'root' })
export class OfflineVideoService {
  readonly supported = typeof caches !== 'undefined' && typeof fetch !== 'undefined';
  private readonly _saved = signal<Record<string, SavedVideo>>(this.readList());
  /** Téléchargements en cours : identifiant → pourcentage (null si la taille totale est inconnue). */
  private readonly _progress = signal<Record<string, number | null>>({});
  private readonly objectUrls = new Map<string, string>();
  private readonly controllers = new Map<string, AbortController>();

  readonly saved = this._saved.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly savedList = computed(() => Object.values(this._saved()));
  readonly totalBytes = computed(() => this.savedList().reduce((sum, video) => sum + video.sizeBytes, 0));

  /** Vidéo livrée avec l'application : toujours lisible hors connexion, rien à télécharger. */
  isBuiltIn(video: Pick<Video, 'src'>): boolean {
    return video.src.startsWith('assets/');
  }

  isSaved(id: string): boolean {
    return id in this._saved();
  }

  isDownloading(id: string): boolean {
    return id in this._progress();
  }

  async download(video: Video): Promise<void> {
    if (!this.supported) throw new Error('Votre appareil ne permet pas d’enregistrer des vidéos.');
    if (this.isSaved(video.id) || this.isDownloading(video.id)) return;
    const controller = new AbortController();
    this.controllers.set(video.id, controller);
    this.setProgress(video.id, 0);
    try {
      const response = await fetch(video.src, { signal: controller.signal });
      if (!response.ok || !response.body) throw new Error('La vidéo n’a pas pu être téléchargée.');
      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        this.setProgress(video.id, total ? Math.min(99, Math.round((received / total) * 100)) : null);
      }
      const blob = new Blob(chunks, { type: response.headers.get('content-type') ?? 'video/mp4' });
      const cache = await caches.open(CACHE_NAME);
      await cache.put(this.cacheKey(video.id), new Response(blob, { headers: { 'Content-Type': blob.type } }));
      this._saved.update((current) => ({
        ...current,
        [video.id]: {
          id: video.id,
          title: video.title,
          author: video.author,
          duration: video.duration,
          lang: video.lang,
          description: video.description,
          sizeBytes: blob.size,
          savedAt: new Date().toISOString(),
        },
      }));
      this.writeList();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new Error('Plus assez de place sur le téléphone. Retirez une vidéo enregistrée puis réessayez.');
      }
      throw error instanceof Error && error.message.startsWith('La vidéo')
        ? error
        : new Error('Le téléchargement a échoué. Vérifiez votre connexion et réessayez.');
    } finally {
      this.controllers.delete(video.id);
      this._progress.update(({ [video.id]: _, ...rest }) => rest);
    }
  }

  cancel(id: string): void {
    this.controllers.get(id)?.abort();
  }

  async remove(id: string): Promise<void> {
    if (this.supported) await (await caches.open(CACHE_NAME)).delete(this.cacheKey(id));
    const url = this.objectUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.objectUrls.delete(id);
    this._saved.update(({ [id]: _, ...rest }) => rest);
    this.writeList();
  }

  /** Adresse locale du fichier enregistré, ou null s'il a disparu (stockage vidé par le système). */
  async localUrl(id: string): Promise<string | null> {
    const existing = this.objectUrls.get(id);
    if (existing) return existing;
    if (!this.supported || !this.isSaved(id)) return null;
    const response = await (await caches.open(CACHE_NAME)).match(this.cacheKey(id));
    if (!response) {
      await this.remove(id);
      return null;
    }
    const url = URL.createObjectURL(await response.blob());
    this.objectUrls.set(id, url);
    return url;
  }

  private cacheKey(id: string): string {
    return `/neya-hors-ligne/${encodeURIComponent(id)}`;
  }

  private setProgress(id: string, value: number | null): void {
    this._progress.update((current) => ({ ...current, [id]: value }));
  }

  private readList(): Record<string, SavedVideo> {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  private writeList(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._saved()));
    } catch {
      // Liste non enregistrée : les vidéos restent dans le cache et réapparaîtront au prochain chargement en ligne.
    }
  }
}

/** « 9,1 Mo » */
export function formatSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} Ko`;
  return `${(bytes / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}
