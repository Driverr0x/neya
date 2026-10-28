import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { addIcons } from 'ionicons';
import {
  callOutline,
  chatbubblesOutline,
  cloudOfflineOutline,
  lockClosedOutline,
  micOutline,
  sendOutline,
  stopCircleOutline,
} from 'ionicons/icons';
import { map } from 'rxjs';
import { PROFESSIONALS, SPECIALTY_LABEL } from '../core/data';
import { Professional } from '../core/models';
import { StoreService } from '../core/store.service';
import { BackendService, PlatformDoctor, PlatformMessage } from '../core/backend.service';

interface ConversationDisplayMessage {
  id: string;
  type: 'text' | 'audio';
  content: string;
  audioUrl?: string;
  createdAt: Date;
  status: 'pending' | 'sent';
}

@Component({
  selector: 'app-message',
  templateUrl: './message.page.html',
  styleUrls: ['./message.page.scss'],
  standalone: false,
})
export class MessagePage implements OnDestroy {
  readonly store = inject(StoreService);
  private readonly backend = inject(BackendService);
  readonly specialties = SPECIALTY_LABEL;
  private readonly route = inject(ActivatedRoute);
  readonly proId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );
  readonly professional = signal<Professional | PlatformDoctor | undefined>(undefined);
  readonly remoteMessages = signal<PlatformMessage[]>([]);
  readonly conversationId = signal('');
  readonly messageError = signal('');
  readonly conversation = computed<ConversationDisplayMessage[]>(() => {
    if (!this.backend.configured) {
      const proId = this.proId();
      return proId ? this.store.messages().filter((message) => message.proId === proId) : [];
    }
    return this.remoteMessages().map((message) => ({
      id: message.id,
      type: message.audio_path ? 'audio' : 'text',
      content: message.content,
      audioUrl: message.audioUrl,
      createdAt: new Date(message.created_at),
      status: 'sent',
    }));
  });
  readonly draft = signal('');
  readonly isRecording = signal(false);
  readonly isStartingRecording = signal(false);
  readonly recordingError = signal('');
  readonly recordedAudio = signal<{ url: string } | null>(null);
  private mediaRecorder?: MediaRecorder;
  private audioStream?: MediaStream;
  private discardRecording = false;
  private recordingFailed = false;
  private destroyed = false;
  private loadedProfessionalId = '';
  private unsubscribeConversation?: () => void;

  constructor() {
    addIcons({
      callOutline,
      chatbubblesOutline,
      cloudOfflineOutline,
      lockClosedOutline,
      micOutline,
      sendOutline,
      stopCircleOutline,
    });
    effect(() => {
      const id = this.proId();
      if (id && id !== this.loadedProfessionalId) void this.loadProfessional(id);
    });
  }

  async sendMessage(professional: Professional | PlatformDoctor): Promise<void> {
    const content = this.draft().trim();
    if (!content || !this.store.online()) return;

    try {
      if (this.backend.configured && 'structureId' in professional) {
        const conversationId = await this.ensureConversation(professional);
        const message = await this.backend.sendMessage(conversationId, content);
        this.addRemoteMessage(message);
      } else {
        this.store.sendMessage(professional, content);
      }
      this.messageError.set('');
      this.draft.set('');
    } catch (error) {
      this.messageError.set(this.errorMessage(error));
    }
  }

  async startRecording(): Promise<void> {
    if (this.isStartingRecording() || this.isRecording()) return;

    this.recordingError.set('');
    this.clearRecordedAudio();

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.recordingError.set('L’enregistrement audio n’est pas pris en charge sur cet appareil.');
      return;
    }

    this.isStartingRecording.set(true);
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.destroyed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      this.audioStream = stream;
      this.mediaRecorder = recorder;
      this.discardRecording = false;
      this.recordingFailed = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        this.recordingFailed = true;
        this.recordingError.set('L’enregistrement a échoué. Veuillez réessayer.');
        this.isRecording.set(false);
        this.stopAudioStream();
      };
      recorder.onstop = () => {
        this.stopAudioStream();
        this.isRecording.set(false);
        if (this.discardRecording || this.recordingFailed) return;

        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          this.recordingError.set('Aucun son n’a été enregistré. Veuillez réessayer.');
          return;
        }
        this.recordedAudio.set({ url: URL.createObjectURL(blob) });
      };

      recorder.start();
      this.isRecording.set(true);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      this.audioStream = undefined;
      this.recordingError.set(this.recordingErrorMessage(error));
    } finally {
      this.isStartingRecording.set(false);
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop();
  }

  cancelAudio(): void {
    if (this.isRecording()) {
      this.discardRecording = true;
      this.stopRecording();
    }
    this.clearRecordedAudio();
    this.recordingError.set('');
  }

  async sendAudio(professional: Professional | PlatformDoctor): Promise<void> {
    const recording = this.recordedAudio();
    if (!recording || !this.store.online()) return;

    try {
      if (this.backend.configured && 'structureId' in professional) {
        const conversationId = await this.ensureConversation(professional);
        const response = await fetch(recording.url);
        if (!response.ok) throw new Error('Impossible de lire l’enregistrement audio.');
        const message = await this.backend.sendMessage(conversationId, '', await response.blob());
        this.addRemoteMessage(message);
      } else {
        this.store.sendAudioMessage(professional, recording.url);
      }
      this.messageError.set('');
      this.recordedAudio.set(null);
    } catch (error) {
      this.messageError.set(this.errorMessage(error));
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.unsubscribeConversation?.();
    this.discardRecording = true;
    if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop();
    this.stopAudioStream();
    this.clearRecordedAudio();
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  phoneHref(phone: string): string {
    return `tel:${phone.replace(/\s+/g, '')}`;
  }

  private clearRecordedAudio(): void {
    const recording = this.recordedAudio();
    if (recording) URL.revokeObjectURL(recording.url);
    this.recordedAudio.set(null);
  }

  private stopAudioStream(): void {
    this.audioStream?.getTracks().forEach((track) => track.stop());
    this.audioStream = undefined;
  }

  private recordingErrorMessage(error: unknown): string {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return 'Autorisez l’accès au microphone dans les réglages de votre appareil pour enregistrer un audio.';
    }
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return 'Aucun microphone n’a été détecté sur cet appareil.';
    }
    return 'Impossible d’accéder au microphone. Vérifiez ses autorisations puis réessayez.';
  }

  private async loadProfessional(id: string): Promise<void> {
    this.loadedProfessionalId = id;
    this.messageError.set('');
    try {
      if (!this.backend.configured) {
        this.professional.set(PROFESSIONALS.find((item) => item.id === id));
        return;
      }
      await this.backend.ensureVisitorSession();
      const doctor = await this.backend.doctorById(id);
      this.professional.set(doctor ?? undefined);
      if (!doctor) return;
      const conversation = await this.backend.patientConversation(doctor.id);
      if (!conversation) return;
      this.conversationId.set(conversation.id);
      this.remoteMessages.set(await this.backend.conversationMessages(conversation.id));
      this.unsubscribeConversation = this.backend.subscribeToConversation(
        conversation.id,
        (message) => this.addRemoteMessage(message),
        (error) => this.messageError.set(error.message),
      );
    } catch (error) {
      this.messageError.set(this.errorMessage(error));
    }
  }

  private async ensureConversation(doctor: PlatformDoctor): Promise<string> {
    let id = this.conversationId();
    if (!id) {
      id = await this.backend.startConversation(doctor);
      this.conversationId.set(id);
      this.unsubscribeConversation = this.backend.subscribeToConversation(
        id,
        (message) => this.addRemoteMessage(message),
        (error) => this.messageError.set(error.message),
      );
    }
    return id;
  }

  private addRemoteMessage(message: PlatformMessage): void {
    this.remoteMessages.update((messages) =>
      messages.some((item) => item.id === message.id) ? messages : [...messages, message],
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Impossible d’envoyer le message. Veuillez réessayer.';
  }
}
