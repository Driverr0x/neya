import {
  Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationError, NavigationStart, Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowUndo, checkmark, volumeHighOutline } from 'ionicons/icons';
import { AudioGuideService } from '../pages/core/audio-guide.service';
import { TalkingTile } from '../pages/core/models';

/** Durée maximale accordée à une lecture, au cas où le navigateur ne signale jamais la fin. */
const MAX_SPEECH_MS = 6000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Tuiles qui s'allument l'une après l'autre, en boucle : la tuile active brille, affiche son mot
 * et le prononce. Toucher une tuile ouvre une confirmation (✔ / ↩) avant d'émettre le choix.
 * Le retour n'est pas une croix, pour ne pas se confondre avec la tuile « Pas de symptômes ».
 */
@Component({
  selector: 'app-talking-tiles',
  standalone: true,
  imports: [NgTemplateOutlet, IonIcon],
  templateUrl: './talking-tiles.component.html',
  styleUrls: ['./talking-tiles.component.scss'],
})
export class TalkingTilesComponent {
  readonly tiles = input.required<TalkingTile[]>();
  /** La boucle ne tourne (et ne parle) que lorsque l'écran est visible. */
  readonly running = input(true);
  readonly selected = input<string[]>([]);
  /** Temps minimal passé sur chaque tuile. */
  readonly dwellMs = input(2200);
  readonly chosen = output<TalkingTile>();

  readonly audio = inject(AudioGuideService);
  readonly active = signal(-1);
  readonly confirming = signal<TalkingTile | null>(null);
  /** Images qui n'ont pas pu se charger : la tuile affiche alors son icône. */
  readonly brokenImages = signal<ReadonlySet<string>>(new Set());
  /** Faux dès que la personne quitte l'écran qui contient les tuiles. */
  private readonly pageVisible = signal(true);
  private run = 0;
  private looping = false;

  constructor() {
    addIcons({ arrowUndo, checkmark, volumeHighOutline });
    effect(() => {
      const shouldRun = this.running() && this.pageVisible() && !this.confirming() && this.tiles().length > 0;
      untracked(() => (shouldRun ? void this.loop() : this.halt()));
    });
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.halt());

    // Pause dès le début d'une navigation : l'écran ne doit plus rien dire pendant qu'on le quitte.
    // Si la navigation échoue, on reste sur l'écran et la boucle reprend.
    inject(Router).events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.pageVisible.set(false);
        this.halt();
      } else if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.pageVisible.set(true);
      }
    });

    // Ionic gèle la détection de changements d'un écran quitté : les inputs n'y arrivent plus.
    // On écoute donc directement les événements de cycle de vie de la page.
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      const page = host.closest('.ion-page');
      if (!page) return;
      const leave = () => {
        this.pageVisible.set(false);
        this.halt();
      };
      const enter = () => this.pageVisible.set(true);
      page.addEventListener('ionViewWillLeave', leave);
      page.addEventListener('ionViewDidEnter', enter);
      destroyRef.onDestroy(() => {
        page.removeEventListener('ionViewWillLeave', leave);
        page.removeEventListener('ionViewDidEnter', enter);
      });
    });
  }

  pick(tile: TalkingTile): void {
    this.halt();
    this.audio.unlock();
    this.active.set(this.tiles().indexOf(tile));
    this.confirming.set(tile);
    void this.audio.say(tile.audio, tile.fallback);
  }

  imageFailed(src: string): void {
    console.warn(`[NEYA] Image de tuile introuvable : ${src}`);
    this.brokenImages.update((broken) => new Set([...broken, src]));
  }

  confirm(tile: TalkingTile): void {
    this.confirming.set(null);
    this.chosen.emit(tile);
  }

  cancel(): void {
    this.confirming.set(null);
  }

  unlockSound(): void {
    this.audio.unlock();
    if (!this.running() || this.confirming()) return;
    this.halt();
    void this.loop();
  }

  private async loop(): Promise<void> {
    const run = ++this.run;
    this.looping = true;
    let index = this.active() + 1;
    while (run === this.run && this.pageVisible()) {
      const tiles = this.tiles();
      index %= tiles.length;
      this.active.set(index);
      const started = Date.now();
      await Promise.race([this.audio.say(tiles[index].audio, tiles[index].fallback), wait(MAX_SPEECH_MS)]);
      const remaining = this.dwellMs() - (Date.now() - started);
      if (remaining > 0) await wait(remaining);
      index++;
    }
  }

  /** Sans effet si la boucle est déjà arrêtée, pour ne pas couper la voix de la confirmation. */
  private halt(): void {
    if (!this.looping) return;
    this.looping = false;
    this.run++;
    this.audio.stop();
  }
}
