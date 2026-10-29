import { Injectable } from '@angular/core';
import { createClient, FunctionsHttpError, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Lang, OrientationResult, Professional, Specialty } from './models';

export interface AccountProfile {
  id: string;
  role: 'patient' | 'structure_admin' | 'doctor';
  status: 'active' | 'pending' | 'disabled';
  display_name: string;
  phone: string | null;
  structure_id: string | null;
  specialty: Specialty | null;
  languages: Lang[] | null;
  bio: string | null;
  order_number?: string | null;
  order_verified_at?: string | null;
}

export interface PlatformDoctor extends Professional {
  structureId: string;
  status: string;
}

export interface PlatformStructure {
  id: string;
  name: string;
  city: string;
  phone: string;
  address: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
}

export interface PlatformVideo {
  id: string;
  doctor_id: string;
  structure_id: string;
  title: string;
  description: string;
  language: Lang;
  storage_path: string;
  published: boolean;
  created_at: string;
  videoUrl?: string;
  author?: string;
  duration: string;
  lang: Lang;
  src: string;
}

export interface PlatformBooking {
  id: string;
  kind: 'appointment' | 'screening';
  screening_event_id: string | null;
  full_name: string;
  phone: string;
  slot_label: string | null;
  status: 'requested' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  screening_events?: { title: string; starts_at: string; ends_at: string; location: string } | null;
}

export interface PlatformConversation {
  id: string;
  patient_id: string;
  doctor_id: string;
  structure_id: string;
  created_at: string;
  patientName?: string;
  messages?: PlatformMessage[];
}

export interface PlatformMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  audio_path: string | null;
  created_at: string;
  audioUrl?: string;
}

/**
 * Inscription en attente, enregistrée dans le compte Supabase (user_metadata) au moment de la
 * création : elle survit à la confirmation par e-mail, à un rechargement ou à un autre onglet.
 */
export type PendingRegistration =
  | { kind: 'structure'; name: string; city: string; phone: string; address: string }
  | {
      kind: 'doctor';
      displayName: string;
      phone: string;
      specialty: Specialty;
      languages: Lang[];
      bio: string;
      inviteCode: string;
      orderNumber: string;
    };

const PENDING_REGISTRATION_KEY = 'neya_registration';

/** Messages renvoyés par Supabase et nos fonctions serveur, traduits pour l'interface. */
const SERVER_MESSAGES: [string, string][] = [
  ['Invalid login credentials', 'E-mail ou mot de passe incorrect.'],
  ['Email not confirmed', 'Confirmez d’abord votre adresse e-mail grâce au lien reçu.'],
  ['User already registered', 'Un compte existe déjà avec cette adresse e-mail. Connectez-vous.'],
  ['Password should be at least', 'Le mot de passe doit contenir au moins 8 caractères.'],
  ['Unable to validate email address', 'Adresse e-mail invalide.'],
  ['rate limit', 'Trop de tentatives. Patientez quelques minutes puis réessayez.'],
  ['Anonymous sign-ins are disabled', 'L’accès visiteur n’est pas activé sur le serveur (connexion anonyme).'],
  ['A verified account is required', 'Un compte confirmé par e-mail est nécessaire.'],
  ['Authentication is required', 'Votre session a expiré. Reconnectez-vous.'],
  ['Authentication is invalid or expired', 'Votre session a expiré. Reconnectez-vous.'],
  ['Please provide a valid name, city, phone, and address', 'Vérifiez le nom, la ville et le téléphone de la structure.'],
  ['This account cannot register a structure', 'Ce compte est déjà rattaché à une structure ou à un médecin.'],
  ['Please provide a valid name, phone, and invitation code', 'Vérifiez le nom, le téléphone et le code d’invitation.'],
  ['Please provide a valid specialty, language, and biography', 'Vérifiez la spécialité, les langues et la présentation.'],
  ['Invitation is invalid, expired, or already used', 'Ce code d’invitation est invalide, expiré ou déjà utilisé.'],
  ['This account cannot join a structure', 'Ce compte est déjà rattaché à une structure.'],
  ['Only a structure manager can invite doctors', 'Seule une structure peut inviter des médecins.'],
  ['The structure must be verified before inviting doctors', 'La structure doit être vérifiée par l’équipe NEYA avant d’inviter des médecins.'],
  ['Booking not found or access denied', 'Demande introuvable ou accès refusé.'],
  ['Please wait before requesting another AI explanation', 'Patientez un instant avant de redemander une explication.'],
  ['AI interpretation is not configured on the server', 'Le service IA n’est pas encore configuré.'],
  ['AI interpretation is temporarily unavailable', 'Le service IA est momentanément indisponible.'],
  ['AI provider rejected the API key', 'Le service IA est mal configuré (clé refusée).'],
  ['AI provider quota exceeded or rate limited', 'Le service IA est saturé. Réessayez plus tard.'],
  ['AI provider model not found', 'Le service IA est mal configuré (modèle introuvable).'],
  ['AI provider returned an invalid response', 'Le service IA est momentanément indisponible.'],
  ['AI provider took too long to respond', 'Le service IA met trop de temps à répondre. Réessayez dans un instant.'],
  ['Only the NEYA team can review structures', 'Cet écran est réservé à l’équipe NEYA.'],
  ['Structure not found', 'Structure introuvable.'],
  ['Doctor not found', 'Médecin introuvable.'],
  ['Referral not found or access denied', 'Résumé introuvable ou accès refusé.'],
  ['Follow-up note is too long', 'La note de suivi est trop longue (2 000 caractères maximum).'],
  ['Please provide a valid order number', 'Indiquez votre numéro d’ordre (3 à 40 caractères).'],
  ['Please ask a shorter question', 'Votre question est trop longue : 400 caractères au maximum.'],
  ['Recovery code is invalid', 'Ce code n’est pas complet. Il compte 16 caractères après « NEYA ».'],
  ['Recovery code not found', 'Code introuvable. Vérifiez-le : un code déjà utilisé ou remplacé ne marche plus.'],
  ['Recovery code belongs to this phone', 'Ce code est celui de ce téléphone : vos messages sont déjà ici.'],
  ['Too many recovery attempts, please wait', 'Trop d’essais. Patientez un quart d’heure avant de réessayer.'],
  ['Recovery is only available for visitor sessions', 'Le code de récupération est réservé aux utilisatrices.'],
  ['row-level security', 'Action refusée pour ce compte.'],
];

/** Seuls le niveau, l'intitulé, le message et les raisons partent vers l'IA. */
function aiResult(result: OrientationResult) {
  return { level: result.level, title: result.title, message: result.message, reasons: result.reasons };
}

export interface RecoveredData {
  conversations: number;
  bookings: number;
  referrals: number;
}

export function translateServerMessage(message: string): string {
  return SERVER_MESSAGES.find(([needle]) => message.includes(needle))?.[1] ?? message;
}

type Area = 'visitor' | 'pro';

/** La visiteuse est déjà inscrite à ce dépistage (une seule inscription par dépistage). */
export class AlreadyRegisteredError extends Error {
  constructor() {
    super('Vous êtes déjà inscrite à ce dépistage.');
  }
}

export type CaseStatus = 'received' | 'contacted' | 'suspected' | 'confirmed' | 'ruled_out';

/** Résumé d'évaluation envoyé par une utilisatrice, avec son accord, à une structure. */
export interface Referral {
  id: string;
  full_name: string;
  phone: string;
  level: 1 | 2 | 3;
  title: string;
  reasons: string[];
  age_range: string | null;
  symptoms: string[];
  language: Lang;
  city: string | null;
  consent_at: string;
  case_status: CaseStatus;
  follow_up_note: string | null;
  /** Note rédigée par l'IA pour le soignant, relue par l'utilisatrice avant l'envoi. */
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralInput {
  structureId: string;
  fullName: string;
  phone: string;
  level: 1 | 2 | 3;
  title: string;
  reasons: string[];
  ageRange: string | null;
  symptoms: string[];
  language: Lang;
  city: string | null;
  consentAt: string;
  aiSummary: string | null;
}

/** Échange précédent, renvoyé à l'IA pour qu'elle comprenne une question de suite. Rien n'est enregistré. */
export interface AiTurn {
  question: string;
  answer: string;
}

/** Médecin vu par l'équipe NEYA, pour vérifier son numéro d'ordre. */
export interface ReviewedDoctor {
  id: string;
  display_name: string;
  specialty: Specialty | null;
  phone: string | null;
  order_number: string | null;
  order_verified_at: string | null;
  status: 'active' | 'pending' | 'disabled';
  structure_name: string | null;
  structure_city: string | null;
  email: string | null;
  created_at: string;
}

/** Structure vue par l'équipe NEYA, avec l'e-mail du compte qui l'a créée. */
export interface ReviewedStructure {
  id: string;
  name: string;
  city: string;
  phone: string;
  address: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  owner_email: string | null;
  doctor_count: number;
}

export interface PlatformScreening {
  id: string;
  structure_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  location: string;
  free: boolean;
  structures?: Pick<PlatformStructure, 'name' | 'city'>;
}

@Injectable({ providedIn: 'root' })
export class BackendService {
  /**
   * Deux sessions indépendantes sur le même appareil : la visiteuse (anonyme) et l'espace pro.
   * Sinon, se connecter en tant que structure remplace la session de la visiteuse, et ses
   * rendez-vous ou messages sont refusés par la base (ce n'est plus un compte « patiente »).
   */
  private readonly visitorClient = this.createSupabase('neya-visitor', false);
  /** Seul le client pro lit le lien de confirmation d'e-mail. */
  private readonly proClient = this.createSupabase('neya-pro', true);

  get configured(): boolean {
    return this.visitorClient !== null;
  }

  get visitor(): SupabaseClient {
    return this.require(this.visitorClient);
  }

  get pro(): SupabaseClient {
    return this.require(this.proClient);
  }

  async ensureVisitorSession(): Promise<User> {
    const client = this.visitor;
    const { data: current, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (current.session) return current.session.user;

    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw new Error(translateServerMessage(error.message));
    if (!data.user) throw new Error('Anonymous session was not created.');
    return data.user;
  }

  async signUp(
    email: string,
    password: string,
    registration: PendingRegistration,
  ): Promise<{ user: User | null; needsEmailConfirmation: boolean }> {
    const { data, error } = await this.pro.auth.signUp({
      email,
      password,
      options: {
        data: { [PENDING_REGISTRATION_KEY]: registration },
        // Le lien de confirmation ramène sur l'espace pro, qui termine l'inscription tout seul.
        emailRedirectTo: `${window.location.origin}/professional-access`,
      },
    });
    if (error) throw new Error(translateServerMessage(error.message));
    return { user: data.user, needsEmailConfirmation: !data.session };
  }

  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await this.pro.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateServerMessage(error.message));
    return data.user;
  }

  async signOut(): Promise<void> {
    const { error } = await this.pro.auth.signOut();
    if (error) throw error;
  }

  /** Utilisateur connecté à l'espace pro, ou `null` (sans erreur) s'il n'y a pas de session. */
  async proUser(): Promise<User | null> {
    const { data, error } = await this.pro.auth.getSession();
    if (error) throw error;
    return data.session?.user ?? null;
  }

  pendingRegistration(user: User): PendingRegistration | null {
    const value: unknown = user.user_metadata?.[PENDING_REGISTRATION_KEY];
    if (!value || typeof value !== 'object') return null;
    const pending = value as Record<string, unknown>;
    const text = (key: string) => (typeof pending[key] === 'string' ? (pending[key] as string) : '');
    if (pending['kind'] === 'structure') {
      return { kind: 'structure', name: text('name'), city: text('city'), phone: text('phone'), address: text('address') };
    }
    if (pending['kind'] === 'doctor') {
      const specialty = text('specialty');
      const languages = Array.isArray(pending['languages'])
        ? (pending['languages'] as unknown[]).filter((language): language is Lang =>
            language === 'fr' || language === 'moore' || language === 'dioula')
        : [];
      return {
        kind: 'doctor',
        displayName: text('displayName'),
        phone: text('phone'),
        specialty: specialty === 'sage-femme' || specialty === 'psychologue' ? specialty : 'medecin',
        languages: languages.length ? languages : ['fr'],
        bio: text('bio'),
        inviteCode: text('inviteCode'),
        orderNumber: text('orderNumber'),
      };
    }
    return null;
  }

  /** Efface l'inscription en attente (dont le code d'invitation) une fois qu'elle a abouti. */
  async clearPendingRegistration(): Promise<void> {
    const { error } = await this.pro.auth.updateUser({ data: { [PENDING_REGISTRATION_KEY]: null } });
    if (error) throw error;
  }

  async currentProfile(): Promise<AccountProfile | null> {
    const user = await this.proUser();
    if (!user) return null;
    const { data, error } = await this.pro
      .from('profiles')
      .select('id,role,status,display_name,phone,structure_id,specialty,languages,bio,order_number,order_verified_at')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data as AccountProfile | null;
  }

  async registerStructure(input: {
    name: string;
    city: string;
    phone: string;
    address: string;
  }): Promise<void> {
    await this.invoke('register-structure', input);
  }

  async registerDoctor(input: {
    displayName: string;
    phone: string;
    specialty: Specialty;
    languages: Lang[];
    bio: string;
    inviteCode: string;
    orderNumber: string;
  }): Promise<void> {
    await this.invoke('register-doctor', input);
  }

  async createDoctorInvite(): Promise<string> {
    const data = await this.invoke<{ inviteCode?: unknown }>('create-doctor-invite', {});
    if (typeof data?.inviteCode !== 'string') throw new Error('Le serveur a renvoyé une invitation invalide.');
    return data.inviteCode;
  }

  async browseStructures(): Promise<PlatformStructure[]> {
    const { data, error } = await this.visitor
      .from('structures')
      .select('id,name,city,phone,address,approval_status')
      .eq('approval_status', 'approved')
      .order('name');
    if (error) throw error;
    return data as PlatformStructure[];
  }

  async browseDoctors(): Promise<PlatformDoctor[]> {
    const { data: profiles, error: profileError } = await this.visitor
      .from('profiles')
      .select('id,display_name,phone,structure_id,specialty,languages,bio,status')
      .eq('role', 'doctor')
      .eq('status', 'active');
    if (profileError) throw profileError;
    const structures = await this.browseStructures();
    const structuresById = new Map(structures.map((structure) => [structure.id, structure]));
    return (profiles ?? []).flatMap((profile) => {
      const structure = profile.structure_id
        ? structuresById.get(profile.structure_id)
        : undefined;
      if (!structure || !profile.specialty) return [];
      return [{
        id: profile.id,
        name: profile.display_name,
        specialty: profile.specialty as Specialty,
        structure: structure.name,
        structureId: structure.id,
        city: structure.city,
        langs: (profile.languages ?? ['fr']) as Lang[],
        responseDelay: 'selon disponibilité',
        phone: profile.phone ?? structure.phone,
        bio: profile.bio ?? '',
        status: profile.status,
      }];
    });
  }

  async doctorById(id: string): Promise<PlatformDoctor | null> {
    const doctors = await this.browseDoctors();
    return doctors.find((doctor) => doctor.id === id) ?? null;
  }

  async browseVideos(): Promise<PlatformVideo[]> {
    const { data, error } = await this.visitor
      .from('videos')
      .select('id,doctor_id,structure_id,title,description,language,storage_path,published,created_at')
      .eq('published', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const videos = data as Omit<PlatformVideo, 'videoUrl' | 'author' | 'duration' | 'lang' | 'src'>[];
    const doctorIds = [...new Set(videos.map((video) => video.doctor_id))];
    if (doctorIds.length === 0) return [];
    const { data: doctors, error: doctorError } = await this.visitor
      .from('profiles')
      .select('id,display_name')
      .in('id', doctorIds);
    if (doctorError) throw doctorError;
    const authorById = new Map((doctors ?? []).map((doctor) => [doctor.id as string, doctor.display_name as string]));
    return Promise.all(videos.map(async (video) => {
      const signedVideo = await this.withVideoUrl({
        ...video,
        duration: '',
        lang: video.language,
        src: '',
        author: authorById.get(video.doctor_id) ?? 'Professionnel de santé',
      }, 'visitor');
      return { ...signedVideo, src: signedVideo.videoUrl ?? '' };
    }));
  }

  async browseScreenings(): Promise<PlatformScreening[]> {
    const { data, error } = await this.visitor
      .from('screening_events')
      .select('id,structure_id,title,description,starts_at,ends_at,location,free,structures(name,city)')
      .eq('published', true)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at');
    if (error) throw error;
    return (data ?? []).map((event) => ({
      ...event,
      structures: Array.isArray(event.structures) ? event.structures[0] : event.structures,
    })) as PlatformScreening[];
  }

  async submitBooking(input: {
    structureId: string;
    kind: 'appointment' | 'screening';
    fullName: string;
    phone: string;
    slotLabel?: string;
    screeningEventId?: string;
  }): Promise<string> {
    const user = await this.ensureVisitorSession();
    const { data, error } = await this.visitor.from('bookings').insert({
      patient_id: user.id,
      structure_id: input.structureId,
      kind: input.kind,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      slot_label: input.slotLabel ?? null,
      screening_event_id: input.screeningEventId ?? null,
    }).select('id').single();
    // 23505 : l'index unique (visiteuse, dépistage) refuse une seconde inscription.
    if (error?.code === '23505') throw new AlreadyRegisteredError();
    if (error) throw new Error(translateServerMessage(error.message));
    return data.id as string;
  }

  /** Dépistages auxquels la visiteuse est inscrite : identifiant du dépistage → statut de l'inscription. */
  async myScreeningRegistrations(): Promise<Record<string, PlatformBooking['status']>> {
    const user = await this.ensureVisitorSession();
    const { data, error } = await this.visitor
      .from('bookings')
      .select('screening_event_id,status')
      .eq('patient_id', user.id)
      .eq('kind', 'screening');
    if (error) throw new Error(translateServerMessage(error.message));
    return Object.fromEntries(
      (data ?? []).map((row) => [row.screening_event_id as string, row.status as PlatformBooking['status']]),
    );
  }

  async startConversation(doctor: PlatformDoctor): Promise<string> {
    const user = await this.ensureVisitorSession();
    const { data: existing, error: findError } = await this.visitor
      .from('conversations')
      .select('id')
      .eq('patient_id', user.id)
      .eq('doctor_id', doctor.id)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return existing.id as string;

    const { data, error } = await this.visitor
      .from('conversations')
      .insert({
        patient_id: user.id,
        doctor_id: doctor.id,
        structure_id: doctor.structureId,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  }

  async sendMessage(conversationId: string, content: string, audio?: Blob): Promise<PlatformMessage> {
    const user = await this.ensureVisitorSession();
    let audioPath: string | null = null;
    if (audio) {
      audioPath = `${conversationId}/${user.id}/${crypto.randomUUID()}`;
      const { error: uploadError } = await this.visitor.storage
        .from('neya-audio')
        .upload(audioPath, audio, {
          contentType: audio.type.split(';')[0] || 'audio/webm',
          upsert: false,
        });
      if (uploadError) throw uploadError;
    }

    const { data, error } = await this.visitor
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim(),
        audio_path: audioPath,
      })
      .select('id,conversation_id,sender_id,content,audio_path,created_at')
      .single();
    if (error) {
      if (audioPath) {
        const { error: cleanupError } = await this.visitor.storage.from('neya-audio').remove([audioPath]);
        if (cleanupError) {
          throw new Error(`${error.message}. The uploaded audio could not be removed: ${cleanupError.message}`);
        }
      }
      throw error;
    }
    return this.withAudioUrl(data as PlatformMessage, 'visitor');
  }

  async patientConversation(doctorId: string): Promise<PlatformConversation | null> {
    const user = await this.ensureVisitorSession();
    const { data, error } = await this.visitor
      .from('conversations')
      .select('id,patient_id,doctor_id,structure_id,created_at')
      .eq('patient_id', user.id)
      .eq('doctor_id', doctorId)
      .maybeSingle();
    if (error) throw error;
    return data as PlatformConversation | null;
  }

  async conversationMessages(conversationId: string, area: Area = 'visitor'): Promise<PlatformMessage[]> {
    const { data, error } = await this.client(area)
      .from('messages')
      .select('id,conversation_id,sender_id,content,audio_path,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at');
    if (error) throw error;
    return Promise.all((data as PlatformMessage[]).map((message) => this.withAudioUrl(message, area)));
  }

  async doctorConversations(): Promise<PlatformConversation[]> {
    const { data, error } = await this.pro
      .from('conversations')
      .select('id,patient_id,doctor_id,structure_id,created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as PlatformConversation[];
  }

  async manageDoctorConversations(): Promise<PlatformConversation[]> {
    const conversations = await this.doctorConversations();
    return Promise.all(conversations.map(async (conversation) => ({
      ...conversation,
      messages: await this.conversationMessages(conversation.id, 'pro'),
    })));
  }

  async sendDoctorReply(conversationId: string, content: string): Promise<void> {
    const user = await this.requireProUser();
    const { error } = await this.pro.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    });
    if (error) throw error;
  }

  async uploadVideo(input: {
    title: string;
    description: string;
    language: Lang;
    file: File;
  }): Promise<void> {
    const user = await this.requireProUser();
    const profile = await this.currentProfile();
    if (!profile?.structure_id) throw new Error('Un profil médecin rattaché à une structure est nécessaire pour publier une vidéo.');
    const storagePath = `${profile.structure_id}/${user.id}/${crypto.randomUUID()}`;
    const { error: uploadError } = await this.pro.storage
      .from('neya-videos')
      .upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { error } = await this.pro.from('videos').insert({
      doctor_id: user.id,
      structure_id: profile.structure_id,
      title: input.title.trim(),
      description: input.description.trim(),
      language: input.language,
      storage_path: storagePath,
      published: true,
    });
    if (error) {
      const { error: cleanupError } = await this.pro.storage.from('neya-videos').remove([storagePath]);
      if (cleanupError) {
        throw new Error(`${error.message}. The uploaded video could not be removed: ${cleanupError.message}`);
      }
      throw error;
    }
  }

  async structureDashboard(): Promise<{
    structure: PlatformStructure | null;
    doctors: AccountProfile[];
    videos: PlatformVideo[];
    bookings: PlatformBooking[];
    screenings: PlatformScreening[];
    referrals: Referral[];
  }> {
    const user = await this.requireProUser();
    const { data: structure, error: structureError } = await this.pro
      .from('structures')
      .select('id,name,city,phone,address,approval_status')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (structureError) throw structureError;
    if (!structure) return { structure: null, doctors: [], videos: [], bookings: [], screenings: [], referrals: [] };

    const [doctorResult, videoResult, bookingResult, screeningResult, referralResult] = await Promise.all([
      this.pro.from('profiles')
        .select('id,role,status,display_name,phone,structure_id,specialty,languages,bio,order_number,order_verified_at')
        .eq('role', 'doctor').eq('structure_id', structure.id),
      this.pro.from('videos')
        .select('id,doctor_id,structure_id,title,description,language,storage_path,published,created_at')
        .eq('structure_id', structure.id).order('created_at', { ascending: false }),
      this.pro.from('bookings')
        .select('id,kind,screening_event_id,full_name,phone,slot_label,status,created_at,screening_events(title,starts_at,ends_at,location)')
        .eq('structure_id', structure.id).order('created_at', { ascending: false }),
      this.pro.from('screening_events')
        .select('id,structure_id,title,description,starts_at,ends_at,location,free')
        .eq('structure_id', structure.id).order('starts_at'),
      this.pro.from('referrals')
        .select('id,full_name,phone,level,title,reasons,age_range,symptoms,language,city,consent_at,case_status,follow_up_note,ai_summary,created_at,updated_at')
        .eq('structure_id', structure.id).order('created_at', { ascending: false }),
    ]);
    const firstError = doctorResult.error ?? videoResult.error ?? bookingResult.error ?? screeningResult.error
      ?? referralResult.error;
    if (firstError) throw firstError;
    return {
      structure: structure as PlatformStructure,
      doctors: (doctorResult.data ?? []) as AccountProfile[],
      videos: await Promise.all(((videoResult.data ?? []) as Omit<
        PlatformVideo,
        'videoUrl' | 'author' | 'duration' | 'lang' | 'src'
      >[]).map(async (video) => {
        const signedVideo = await this.withVideoUrl({
          ...video,
          author: doctorResult.data?.find((doctor) => doctor.id === video.doctor_id)?.display_name ?? 'Médecin',
          duration: '',
          lang: video.language,
          src: '',
        }, 'pro');
        return { ...signedVideo, src: signedVideo.videoUrl ?? '' };
      })),
      bookings: (bookingResult.data ?? []).map((booking) => ({
        ...booking,
        screening_events: Array.isArray(booking.screening_events)
          ? booking.screening_events[0] ?? null
          : booking.screening_events ?? null,
      })) as PlatformBooking[],
      screenings: (screeningResult.data ?? []) as PlatformScreening[],
      referrals: (referralResult.data ?? []) as Referral[],
    };
  }

  async setBookingStatus(id: string, status: 'confirmed' | 'cancelled' | 'completed'): Promise<void> {
    const { error } = await this.pro.rpc('update_booking_status', {
      p_booking_id: id,
      p_status: status,
    });
    if (error) throw new Error(translateServerMessage(error.message));
  }

  /** Envoie le résumé de l'évaluation à la structure choisie (session visiteuse, avec accord). */
  async sendReferral(input: ReferralInput): Promise<void> {
    const user = await this.ensureVisitorSession();
    // Pas de .select() : l'utilisatrice n'a pas le droit de relire les résumés (seule la structure les voit).
    const { error } = await this.visitor.from('referrals').insert({
      patient_id: user.id,
      structure_id: input.structureId,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      level: input.level,
      title: input.title,
      reasons: input.reasons.slice(0, 8),
      age_range: input.ageRange,
      symptoms: input.symptoms.slice(0, 8),
      language: input.language,
      city: input.city,
      consent_at: input.consentAt,
      ai_summary: input.aiSummary?.trim() || null,
    });
    if (error) throw new Error(translateServerMessage(error.message));
  }

  async updateReferralCase(id: string, status: CaseStatus, note: string): Promise<void> {
    const { error } = await this.pro.rpc('update_referral_case', {
      p_referral_id: id,
      p_status: status,
      p_note: note,
    });
    if (error) throw new Error(translateServerMessage(error.message));
  }

  async isPlatformAdmin(): Promise<boolean> {
    const { data, error } = await this.pro.rpc('is_platform_admin');
    if (error) throw new Error(translateServerMessage(error.message));
    return data === true;
  }

  async reviewStructures(): Promise<ReviewedStructure[]> {
    const { data, error } = await this.pro.rpc('admin_list_structures');
    if (error) throw new Error(translateServerMessage(error.message));
    return (data ?? []) as ReviewedStructure[];
  }

  async setStructureStatus(id: string, status: ReviewedStructure['approval_status']): Promise<void> {
    const { error } = await this.pro.rpc('admin_set_structure_status', {
      p_structure_id: id,
      p_status: status,
    });
    if (error) throw new Error(translateServerMessage(error.message));
  }

  async reviewDoctors(): Promise<ReviewedDoctor[]> {
    const { data, error } = await this.pro.rpc('admin_list_doctors');
    if (error) throw new Error(translateServerMessage(error.message));
    return (data ?? []) as ReviewedDoctor[];
  }

  async setDoctorStatus(id: string, status: ReviewedDoctor['status']): Promise<void> {
    const { error } = await this.pro.rpc('admin_set_doctor_status', { p_doctor_id: id, p_status: status });
    if (error) throw new Error(translateServerMessage(error.message));
  }

  async createScreening(input: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    location: string;
    free: boolean;
  }): Promise<void> {
    const user = await this.requireProUser();
    const { data: structure, error: structureError } = await this.pro
      .from('structures')
      .select('id')
      .eq('owner_id', user.id)
      .single();
    if (structureError) throw structureError;
    const { error } = await this.pro.from('screening_events').insert({
      structure_id: structure.id,
      title: input.title.trim(),
      description: input.description.trim(),
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location: input.location.trim(),
      free: input.free,
      published: true,
    });
    if (error) throw error;
  }

  /** Crée (ou remplace) le code qui permet de retrouver ses données sur un autre téléphone. */
  async createRecoveryCode(): Promise<string> {
    await this.ensureVisitorSession();
    const data = await this.invoke<{ code?: unknown }>('visitor-recovery', { action: 'create' }, 'visitor');
    if (typeof data?.code !== 'string') throw new Error('Le code n’a pas pu être créé.');
    return data.code;
  }

  /** Rapatrie sur ce téléphone les données liées au code ; renvoie ce qui a été retrouvé et le nouveau code. */
  async redeemRecoveryCode(code: string): Promise<{ moved: RecoveredData; code: string }> {
    await this.ensureVisitorSession();
    const data = await this.invoke<{ moved?: RecoveredData; code?: unknown }>(
      'visitor-recovery', { action: 'redeem', code }, 'visitor',
    );
    if (!data?.moved || typeof data.code !== 'string') throw new Error('La récupération n’a pas abouti.');
    return { moved: data.moved, code: data.code };
  }

  /** Question libre de l'utilisatrice après son évaluation. Ni la question ni la réponse ne sont enregistrées. */
  async askQuestion(result: OrientationResult, language: Lang, question: string, history: AiTurn[]): Promise<string> {
    await this.ensureVisitorSession();
    const data = await this.invoke<{ answer?: unknown }>('explain-result', {
      mode: 'question',
      language,
      result: aiResult(result),
      question: question.trim(),
      history: history.slice(-3),
    }, 'visitor');
    if (typeof data?.answer !== 'string') throw new Error('Le service IA a renvoyé une réponse invalide.');
    return data.answer;
  }

  /** Note pour le soignant, rédigée sans le nom ni le téléphone de l'utilisatrice. */
  async draftReferralSummary(input: {
    result: OrientationResult;
    ageRange: string | null;
    symptoms: string[];
    city: string | null;
  }): Promise<string> {
    await this.ensureVisitorSession();
    const data = await this.invoke<{ summary?: unknown }>('explain-result', {
      mode: 'summary',
      language: input.result.language,
      result: aiResult(input.result),
      ageRange: input.ageRange,
      symptoms: input.symptoms.slice(0, 8),
      city: input.city,
    }, 'visitor');
    if (typeof data?.summary !== 'string') throw new Error('Le service IA a renvoyé une réponse invalide.');
    return data.summary;
  }

  async interpretResult(result: OrientationResult, language: Lang): Promise<string> {
    await this.ensureVisitorSession();
    const data = await this.invoke<{ explanation?: unknown }>('explain-result', {
      language,
      result: {
        level: result.level,
        title: result.title,
        message: result.message,
        reasons: result.reasons,
      },
    }, 'visitor');
    if (typeof data?.explanation !== 'string') throw new Error('Le service IA a renvoyé une réponse invalide.');
    return data.explanation;
  }

  subscribeToConversation(
    conversationId: string,
    onMessage: (message: PlatformMessage) => void,
    onError?: (error: Error) => void,
    area: Area = 'visitor',
  ): () => void {
    const client = this.client(area);
    const channel = client
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          void this.withAudioUrl(payload.new as PlatformMessage, area)
            .then(onMessage)
            .catch((error: unknown) => onError?.(
              error instanceof Error ? error : new Error('Could not load a new message.'),
            ));
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }

  private async withAudioUrl(message: PlatformMessage, area: Area): Promise<PlatformMessage> {
    if (!message.audio_path) return message;
    const { data, error } = await this.client(area).storage
      .from('neya-audio')
      .createSignedUrl(message.audio_path, 60 * 60);
    if (error) throw error;
    return { ...message, audioUrl: data.signedUrl };
  }

  private async withVideoUrl(video: PlatformVideo, area: Area): Promise<PlatformVideo> {
    const { data, error } = await this.client(area).storage
      .from('neya-videos')
      .createSignedUrl(video.storage_path, 60 * 60);
    if (error) throw error;
    return { ...video, videoUrl: data.signedUrl };
  }

  private client(area: Area): SupabaseClient {
    return area === 'pro' ? this.pro : this.visitor;
  }

  private async requireProUser(): Promise<User> {
    const user = await this.proUser();
    if (!user) throw new Error('Connectez-vous à l’espace professionnel pour continuer.');
    return user;
  }

  /** Appelle une fonction serveur et remonte son vrai message d'erreur, traduit. */
  private async invoke<T = unknown>(name: string, body: Record<string, unknown>, area: Area = 'pro'): Promise<T> {
    const { data, error } = await this.client(area).functions.invoke(name, { body });
    if (!error) return data as T;
    let serverMessage: unknown;
    if (error instanceof FunctionsHttpError) {
      try {
        serverMessage = ((await error.context.json()) as { error?: unknown } | null)?.error;
      } catch {
        // Réponse non JSON : on garde le message générique.
      }
    }
    throw new Error(translateServerMessage(typeof serverMessage === 'string' ? serverMessage : error.message));
  }

  private require(client: SupabaseClient | null): SupabaseClient {
    if (!client) {
      throw new Error('Supabase is not configured. Set the public URL and anon key in the environment files.');
    }
    return client;
  }

  private createSupabase(storageKey: string, detectSessionInUrl: boolean): SupabaseClient | null {
    if (!environment.supabaseUrl || !environment.supabaseAnonKey) return null;
    return createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: { storageKey, detectSessionInUrl },
    });
  }
}
