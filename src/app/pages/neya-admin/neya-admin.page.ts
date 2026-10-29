import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { BrandHeaderComponent } from '../../shared/brand-header.component';
import { BackendService, ReviewedDoctor, ReviewedStructure } from '../core/backend.service';
import { SPECIALTY_LABEL } from '../core/data';
import { formatLongDate } from '../core/dates';

type Status = ReviewedStructure['approval_status'];

const STATUS_LABEL: Record<Status, string> = {
  pending: 'En attente',
  approved: 'Validées',
  rejected: 'Refusées',
};

type DoctorStatus = ReviewedDoctor['status'];

const DOCTOR_STATUS_LABEL: Record<DoctorStatus, string> = {
  pending: 'À vérifier',
  active: 'Vérifiés',
  disabled: 'Suspendus',
};

/** Écran de l'équipe NEYA : valider les structures et vérifier le numéro d'ordre des médecins. */
@Component({
  selector: 'app-neya-admin',
  standalone: true,
  imports: [BrandHeaderComponent, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './neya-admin.page.html',
  styleUrls: ['../professional-dashboard/professional-dashboard.page.scss', './neya-admin.page.scss'],
})
export class NeyaAdminPage {
  private readonly backend = inject(BackendService);
  private readonly router = inject(Router);

  readonly statuses: Status[] = ['pending', 'approved', 'rejected'];
  readonly statusLabel = STATUS_LABEL;
  readonly filter = signal<Status>('pending');
  readonly structures = signal<ReviewedStructure[]>([]);
  readonly visible = computed(() => this.structures().filter((item) => item.approval_status === this.filter()));
  readonly section = signal<'structures' | 'doctors'>('structures');
  readonly doctorStatuses: DoctorStatus[] = ['pending', 'active', 'disabled'];
  readonly doctorStatusLabel = DOCTOR_STATUS_LABEL;
  readonly specialtyLabel = SPECIALTY_LABEL;
  readonly doctorFilter = signal<DoctorStatus>('pending');
  readonly doctors = signal<ReviewedDoctor[]>([]);
  readonly visibleDoctors = computed(() => this.doctors().filter((item) => item.status === this.doctorFilter()));
  readonly loading = signal(true);
  readonly busyId = signal('');
  readonly error = signal('');
  readonly notice = signal('');

  constructor() {
    void this.load();
  }

  count(status: Status): number {
    return this.structures().filter((item) => item.approval_status === status).length;
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const user = await this.backend.proUser();
      if (!user || user.is_anonymous || !(await this.backend.isPlatformAdmin())) {
        await this.router.navigateByUrl('/professional-access');
        return;
      }
      const [structures, doctors] = await Promise.all([this.backend.reviewStructures(), this.backend.reviewDoctors()]);
      this.structures.set(structures);
      this.doctors.set(doctors);
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async setStatus(structure: ReviewedStructure, status: Status): Promise<void> {
    this.busyId.set(structure.id);
    this.error.set('');
    this.notice.set('');
    try {
      await this.backend.setStructureStatus(structure.id, status);
      this.structures.update((items) =>
        items.map((item) => (item.id === structure.id ? { ...item, approval_status: status } : item)),
      );
      this.notice.set(
        status === 'approved'
          ? `${structure.name} est validée : elle peut maintenant inviter ses médecins.`
          : status === 'rejected'
            ? `${structure.name} est refusée.`
            : `${structure.name} est remise en attente.`,
      );
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.busyId.set('');
    }
  }

  doctorCount(status: DoctorStatus): number {
    return this.doctors().filter((item) => item.status === status).length;
  }

  async setDoctorStatus(doctor: ReviewedDoctor, status: DoctorStatus): Promise<void> {
    this.busyId.set(doctor.id);
    this.error.set('');
    this.notice.set('');
    try {
      await this.backend.setDoctorStatus(doctor.id, status);
      this.doctors.update((items) => items.map((item) => (item.id === doctor.id ? { ...item, status } : item)));
      this.notice.set(
        status === 'active'
          ? `${doctor.display_name} est vérifié(e) : son profil est maintenant visible des utilisatrices.`
          : status === 'disabled'
            ? `${doctor.display_name} est suspendu(e) et n’apparaît plus dans l’application.`
            : `${doctor.display_name} est remis(e) en vérification.`,
      );
    } catch (error) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.busyId.set('');
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.backend.signOut();
      await this.router.navigateByUrl('/professional-access');
    } catch (error) {
      this.error.set(this.errorMessage(error));
    }
  }

  formatDate(value: string): string {
    return formatLongDate(value);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.';
  }
}
