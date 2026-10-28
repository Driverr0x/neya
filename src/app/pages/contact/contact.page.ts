import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonList, IonItem, IonLabel, IonIcon, IonBadge, IonButton
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  callOutline,
  chatbubbleEllipsesOutline,
  personCircleOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LANG_LABEL, PROFESSIONALS, SPECIALTY_LABEL } from '../core/data';
import { Lang, Professional, Specialty } from '../core/models';
import { StoreService } from '../core/store.service';
import { BrandHeaderComponent } from '../../shared/brand-header.component';
import { BackendService, PlatformDoctor } from '../core/backend.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [
    RouterLink, BrandHeaderComponent, IonHeader, IonToolbar, IonTitle, IonContent, 
    IonList, IonItem, IonLabel, IonIcon, IonBadge, IonButton
  ],
  templateUrl: './contact.page.html',
  styleUrls: ['./contact.page.scss'],
})
export class ContactPage {
  store = inject(StoreService);
  spec = SPECIALTY_LABEL;
  private readonly backend = inject(BackendService);
  readonly platformPros = signal<PlatformDoctor[] | null>(null);
  readonly directoryError = signal('');

  private readonly route = inject(ActivatedRoute);
  readonly routeProId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );
  selectedPro = computed(() => {
    const id = this.routeProId();
    return (this.platformPros() ?? PROFESSIONALS).find((professional) => professional.id === id);
  });

  private readonly queryParams = toSignal(
    this.route.queryParamMap,
    { initialValue: this.route.snapshot.queryParamMap },
  );
  fromOrientation = computed(() => this.queryParams().get('from') === 'orientation');
  pros = computed(() => {
    const params = this.queryParams();
    const specialty = this.specialtyParam(params.get('specialty'));
    const language = this.languageParam(params.get('lang'));
    const city = this.store.answers().city?.toLocaleLowerCase();
    const candidates = this.platformPros() ?? (this.backend.configured ? [] : PROFESSIONALS);
    return [...candidates].sort((first, second) => {
      const score = (professional: Professional) =>
        (professional.specialty === specialty ? 4 : 0) +
        (professional.langs.includes(language) ? 2 : 0) +
        (professional.city.toLocaleLowerCase() === city ? 1 : 0);
      return score(second) - score(first);
    });
  });

  langs(p: Pick<Professional, 'langs'>) { 
    return p.langs.map(l => LANG_LABEL[l]).join(', '); 
  }

  phoneHref(phone: string): string {
    return `tel:${phone.replace(/\s+/g, '')}`;
  }

  constructor() {
    addIcons({ callOutline, chatbubbleEllipsesOutline, personCircleOutline, sparklesOutline });
    void this.loadDirectory();
  }

  private async loadDirectory(): Promise<void> {
    if (!this.backend.configured) return;
    try {
      await this.backend.ensureVisitorSession();
      this.platformPros.set(await this.backend.browseDoctors());
    } catch (error) {
      this.directoryError.set(error instanceof Error ? error.message : 'Impossible de charger les professionnels.');
    }
  }

  private specialtyParam(value: string | null): Specialty | null {
    return value && Object.hasOwn(SPECIALTY_LABEL, value) ? (value as Specialty) : null;
  }

  private languageParam(value: string | null): Lang {
    if (value === 'fr' || value === 'moore' || value === 'dioula') return value;
    return this.store.answers().language ?? 'fr';
  }
}