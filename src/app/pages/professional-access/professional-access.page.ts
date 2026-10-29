import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { Lang, Specialty } from '../core/models';
import { BackendService, PendingRegistration } from '../core/backend.service';

type AccessMode = 'login' | 'structure' | 'doctor';

const MIN_PASSWORD_LENGTH = 8;

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
  private readonly feedback = viewChild<ElementRef<HTMLElement>>('feedback');

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
  readonly orderNumber = signal('');
  /** Compte créé et connecté, mais pas encore rattaché comme structure ou médecin. */
  readonly pendingRegistration = signal<'structure' | 'doctor' | null>(null);
  readonly accountEmail = signal('');
  readonly completing = computed(() => this.pendingRegistration() !== null);
  readonly showStructureFields = computed(() =>
    this.completing() ? this.pendingRegistration() === 'structure' : this.mode() === 'structure',
  );
  readonly showDoctorFields = computed(() =>
    this.completing() ? this.pendingRegistration() === 'doctor' : this.mode() === 'doctor',
  );
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  constructor() {
    // Les messages s'affichent en haut du formulaire : on les amène sous les yeux de la personne.
    effect(() => {
      if (!this.error() && !this.notice()) return;
      setTimeout(() => this.feedback()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    });
    if (!this.backend.configured) {
      this.error.set('La connexion Supabase n’est pas encore configurée. Consultez le guide de mise en route du backend.');
      return;
    }
    void this.resume();
  }

  chooseMode(mode: AccessMode): void {
    // Le nom et le téléphone d'une structure n'ont rien à faire dans le formulaire médecin, et inversement.
    if (mode !== this.mode()) this.resetForm();
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

    if (this.completing()) {
      await this.run(() => this.finishRegistration());
      return;
    }

    const email = this.email().trim();
    if (!email || !this.password()) {
      this.error.set('Indiquez votre adresse e-mail et votre mot de passe.');
      return;
    }
    const registrationMode = this.mode();
    if (registrationMode !== 'login') {
      if (this.password().length < MIN_PASSWORD_LENGTH) {
        this.error.set(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
        return;
      }
      // Vérifié avant de créer le compte : sinon le compte existe mais l'inscription échoue.
      const invalid = this.validationError(registrationMode);
      if (invalid) {
        this.error.set(invalid);
        return;
      }
    }

    await this.run(async () => {
      if (registrationMode !== 'login') {
        const result = await this.backend.signUp(email, this.password(), this.registrationFromForm(registrationMode));
        if (result.needsEmailConfirmation) {
          this.mode.set('login');
          this.password.set('');
          this.notice.set('Compte créé. Ouvrez le lien reçu par e-mail : votre inscription se terminera automatiquement. Vous pourrez aussi revenir ici et vous connecter.');
          return;
        }
        this.accountEmail.set(email);
        this.pendingRegistration.set(registrationMode);
      } else {
        const user = await this.backend.signIn(email, this.password());
        this.accountEmail.set(user.email ?? email);
        // Inscription commencée plus tôt (autre onglet, autre appareil, échec précédent).
        const pending = this.backend.pendingRegistration(user);
        if (pending) this.prefill(pending);
      }
      await this.finishRegistration();
    });
  }

  /** Abandonne l'inscription en cours sur ce compte pour en utiliser un autre. */
  async useAnotherAccount(): Promise<void> {
    await this.run(async () => {
      await this.backend.signOut();
      this.pendingRegistration.set(null);
      this.accountEmail.set('');
      this.email.set('');
      this.password.set('');
      this.resetForm();
      this.mode.set('login');
    });
  }

  /** Vide les champs d'inscription (pas l'e-mail ni le mot de passe). */
  private resetForm(): void {
    this.displayName.set('');
    this.phone.set('');
    this.city.set('');
    this.address.set('');
    this.specialty.set('medecin');
    this.languages.set(['fr']);
    this.bio.set('');
    this.inviteCode.set('');
    this.orderNumber.set('');
  }

  /**
   * À l'ouverture : reprend une session pro existante (par exemple au retour du lien de
   * confirmation d'e-mail) et termine l'inscription en attente sans redemander le mot de passe.
   */
  private async resume(): Promise<void> {
    await this.run(async () => {
      const user = await this.backend.proUser();
      if (!user || user.is_anonymous) return;
      const profile = await this.backend.currentProfile();
      if (profile && profile.role !== 'patient') {
        await this.leaveTo('/professional-dashboard');
        return;
      }
      const pending = this.backend.pendingRegistration(user);
      if (!pending) {
        if (await this.backend.isPlatformAdmin()) await this.leaveTo('/neya-admin');
        return;
      }
      this.accountEmail.set(user.email ?? '');
      this.prefill(pending);
      await this.finishRegistration();
    });
  }

  private async finishRegistration(): Promise<void> {
    const profile = await this.backend.currentProfile();
    if (profile && profile.role !== 'patient') {
      // Déjà inscrit : on nettoie une éventuelle inscription restée en attente.
      await this.backend.clearPendingRegistration().catch(() => undefined);
      await this.leaveTo('/professional-dashboard');
      return;
    }

    const registration = this.pendingRegistration();
    if (!registration) {
      if (await this.backend.isPlatformAdmin()) {
        await this.leaveTo('/neya-admin');
        return;
      }
      await this.backend.signOut();
      throw new Error('Ce portail est réservé aux structures et aux médecins. Choisissez « Structure » ou « Médecin » pour créer un compte.');
    }
    const invalid = this.validationError(registration);
    if (invalid) throw new Error(invalid);

    if (registration === 'structure') {
      await this.backend.registerStructure({
        name: this.displayName().trim(),
        city: this.city().trim(),
        phone: this.phone().trim(),
        address: this.address().trim(),
      });
    } else {
      await this.backend.registerDoctor({
        displayName: this.displayName().trim(),
        phone: this.phone().trim(),
        specialty: this.specialty(),
        languages: this.languages(),
        bio: this.bio().trim(),
        inviteCode: this.inviteCode().trim(),
        orderNumber: this.orderNumber().trim(),
      });
    }
    // Le code d'invitation n'a plus à rester dans le compte. Un échec ici n'empêche pas l'accès.
    await this.backend.clearPendingRegistration().catch(() => undefined);
    await this.leaveTo('/professional-dashboard');
  }

  /**
   * Quitte la page en vidant tout le formulaire : Ionic garde la page en mémoire, et sans cela
   * l'e-mail, le mot de passe et les infos du compte précédent réapparaissent à la déconnexion.
   */
  private async leaveTo(url: string): Promise<void> {
    this.pendingRegistration.set(null);
    this.accountEmail.set('');
    this.email.set('');
    this.password.set('');
    this.resetForm();
    this.mode.set('login');
    this.error.set('');
    this.notice.set('');
    await this.router.navigateByUrl(url);
  }

  /** Mêmes règles que les fonctions serveur, vérifiées avant tout envoi. */
  private validationError(kind: 'structure' | 'doctor'): string | null {
    const name = this.displayName().trim();
    const phone = this.phone().trim();
    if (kind === 'structure') {
      if (name.length < 2) return 'Indiquez le nom de la structure.';
      if (this.city().trim().length < 2) return 'Indiquez la ville de la structure.';
      if (phone.length < 5 || phone.length > 32) return 'Indiquez un numéro de téléphone valide pour la structure.';
      return null;
    }
    if (name.length < 2) return 'Indiquez votre nom complet.';
    if (phone.length > 32) return 'Le numéro de téléphone est trop long.';
    const order = this.orderNumber().trim();
    if (order.length < 3 || order.length > 40) {
      return 'Indiquez votre numéro d’inscription à l’Ordre (médecins, sages-femmes…). L’équipe NEYA le vérifie avant de vous rendre visible.';
    }
    const code = this.inviteCode().trim();
    if (!code) return 'Indiquez le code d’invitation que votre structure vous a transmis.';
    if (code.length < 24 || code.length > 128) {
      return 'Ce code d’invitation n’a pas le bon format. Il compte 43 caractères et votre structure le crée depuis son espace NEYA (bouton « Créer un code d’invitation »).';
    }
    return null;
  }

  private registrationFromForm(mode: 'structure' | 'doctor'): PendingRegistration {
    return mode === 'structure'
      ? { kind: 'structure', name: this.displayName().trim(), city: this.city().trim(), phone: this.phone().trim(), address: this.address().trim() }
      : {
          kind: 'doctor',
          displayName: this.displayName().trim(),
          phone: this.phone().trim(),
          specialty: this.specialty(),
          languages: this.languages(),
          bio: this.bio().trim(),
          inviteCode: this.inviteCode().trim(),
          orderNumber: this.orderNumber().trim(),
        };
  }

  /** Remet dans le formulaire les informations saisies à la création du compte. */
  private prefill(pending: PendingRegistration): void {
    this.pendingRegistration.set(pending.kind);
    this.phone.set(pending.phone);
    if (pending.kind === 'structure') {
      this.displayName.set(pending.name);
      this.city.set(pending.city);
      this.address.set(pending.address);
    } else {
      this.displayName.set(pending.displayName);
      this.specialty.set(pending.specialty);
      this.languages.set(pending.languages);
      this.bio.set(pending.bio);
      this.inviteCode.set(pending.inviteCode);
      this.orderNumber.set(pending.orderNumber);
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.loading.set(true);
    try {
      await action();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      this.loading.set(false);
    }
  }
}
