import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { Lang, Specialty } from '../core/models';
import { BackendService } from '../core/backend.service';

type AccessMode = 'login' | 'structure' | 'doctor';

@Component({
  selector: 'app-professional-access',
  standalone: true,
  imports: [RouterLink, IonContent],
  templateUrl: './professional-access.page.html',
  styleUrls: ['./professional-access.page.scss'],
})
export class ProfessionalAccessPage {
  readonly backend = inject(BackendService);
  private readonly router = inject(Router);

  readonly mode = signal<AccessMode>('login');
  readonly email = signal('');
  readonly password = signal('');
  readonly displayName = signal('');
  readonly phone = signal('');
  readonly city = signal('');
  readonly address = signal('');
  readonly specialty = signal<Specialty>('medecin');
  readonly languages = signal<Lang[]>(['fr']);
  readonly bio = signal('');
  readonly inviteCode = signal('');
  readonly pendingRegistration = signal<'structure' | 'doctor' | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  constructor() {
    if (!this.backend.configured) {
      this.error.set('La connexion Supabase n’est pas encore configurée. Consultez le guide de mise en route du backend.');
    }
  }

  chooseMode(mode: AccessMode): void {
    this.mode.set(mode);
    this.error.set('');
    this.notice.set('');
  }

  toggleLanguage(language: Lang, checked: boolean): void {
    this.languages.update((current) => {
      const next = checked
        ? [...new Set([...current, language])]
        : current.filter((item) => item !== language);
      return next.length ? next : current;
    });
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.notice.set('');
    this.loading.set(true);
    try {
      if (this.mode() !== 'login') {
        const registrationMode = this.mode();
        const result = await this.backend.signUp(this.email().trim(), this.password());
        if (registrationMode === 'structure' || registrationMode === 'doctor') {
          this.pendingRegistration.set(registrationMode);
        }
        if (result.needsEmailConfirmation) {
          this.notice.set('Compte créé. Confirmez votre adresse e-mail, puis connectez-vous ici pour terminer l’inscription.');
          this.mode.set('login');
          return;
        }
      } else {
        await this.backend.signIn(this.email().trim(), this.password());
      }

      await this.finishRegistration();
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.backend.signOut();
      this.notice.set('Vous êtes déconnecté.');
    } catch (error) {
      this.error.set(this.errorMessage(error));
    }
  }

  private async finishRegistration(): Promise<void> {
    const registration = this.pendingRegistration();
    if (registration === 'structure') {
      await this.backend.registerStructure({
        name: this.displayName(),
        city: this.city(),
        phone: this.phone(),
        address: this.address(),
      });
      this.pendingRegistration.set(null);
      this.notice.set('Demande envoyée. Le compte structure restera en attente jusqu’à sa vérification par l’équipe NEYA.');
      await this.router.navigateByUrl('/professional-dashboard');
    } else if (registration === 'doctor') {
      await this.backend.registerDoctor({
        displayName: this.displayName(),
        phone: this.phone(),
        specialty: this.specialty(),
        languages: this.languages(),
        bio: this.bio(),
        inviteCode: this.inviteCode(),
      });
      this.pendingRegistration.set(null);
      this.notice.set('Profil médecin créé. Vous pouvez maintenant ouvrir votre espace professionnel.');
      await this.router.navigateByUrl('/professional-dashboard');
      return;
    } else {
      const profile = await this.backend.currentProfile();
      if (!profile || profile.role === 'patient') {
        await this.backend.signOut();
        throw new Error('Ce portail est réservé aux structures et aux médecins.');
      }
      await this.router.navigateByUrl('/professional-dashboard');
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.';
  }
}
