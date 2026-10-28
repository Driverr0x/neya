import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
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
  screening_events?: { title: string; starts_at: string; location: string } | null;
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
  private readonly client: SupabaseClient | null =
    environment.supabaseUrl && environment.supabaseAnonKey
      ? createClient(environment.supabaseUrl, environment.supabaseAnonKey)
      : null;

  get configured(): boolean {
    return this.client !== null;
  }

  get supabase(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase is not configured. Set the public URL and anon key in the environment files.');
    }
    return this.client;
  }

  async ensureVisitorSession(): Promise<User> {
    const client = this.supabase;
    const { data: current, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (current.session) return current.session.user;

    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    if (!data.user) throw new Error('Anonymous session was not created.');
    return data.user;
  }

  async signUp(email: string, password: string): Promise<{ user: User | null; needsEmailConfirmation: boolean }> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
    return { user: data.user, needsEmailConfirmation: !data.session };
  }

  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async currentProfile(): Promise<AccountProfile | null> {
    const { data: authData, error: authError } = await this.supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) return null;
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id,role,status,display_name,phone,structure_id,specialty,languages,bio')
      .eq('id', authData.user.id)
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
    const { error } = await this.supabase.functions.invoke('register-structure', { body: input });
    if (error) throw error;
  }

  async registerDoctor(input: {
    displayName: string;
    phone: string;
    specialty: Specialty;
    languages: Lang[];
    bio: string;
    inviteCode: string;
  }): Promise<void> {
    const { error } = await this.supabase.functions.invoke('register-doctor', {
      body: input,
    });
    if (error) throw error;
  }

  async createDoctorInvite(): Promise<string> {
    const { data, error } = await this.supabase.functions.invoke('create-doctor-invite', {
      body: {},
    });
    if (error) throw error;
    if (typeof data?.inviteCode !== 'string') throw new Error('The server returned an invalid invitation.');
    return data.inviteCode;
  }

  async browseStructures(): Promise<PlatformStructure[]> {
    const { data, error } = await this.supabase
      .from('structures')
      .select('id,name,city,phone,address,approval_status')
      .eq('approval_status', 'approved')
      .order('name');
    if (error) throw error;
    return data as PlatformStructure[];
  }

  async browseDoctors(): Promise<PlatformDoctor[]> {
    const { data: profiles, error: profileError } = await this.supabase
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
    const { data, error } = await this.supabase
      .from('videos')
      .select('id,doctor_id,structure_id,title,description,language,storage_path,published,created_at')
      .eq('published', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const videos = data as Omit<PlatformVideo, 'videoUrl' | 'author' | 'duration' | 'lang' | 'src'>[];
    const doctorIds = [...new Set(videos.map((video) => video.doctor_id))];
    if (doctorIds.length === 0) return [];
    const { data: doctors, error: doctorError } = await this.supabase
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
      });
      return { ...signedVideo, src: signedVideo.videoUrl ?? '' };
    }));
  }

  async browseScreenings(): Promise<PlatformScreening[]> {
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase.from('bookings').insert({
      patient_id: user.id,
      structure_id: input.structureId,
      kind: input.kind,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      slot_label: input.slotLabel ?? null,
      screening_event_id: input.screeningEventId ?? null,
    }).select('id').single();
    if (error) throw error;
    return data.id as string;
  }

  async startConversation(doctor: PlatformDoctor): Promise<string> {
    const user = await this.ensureVisitorSession();
    const { data: existing, error: findError } = await this.supabase
      .from('conversations')
      .select('id')
      .eq('patient_id', user.id)
      .eq('doctor_id', doctor.id)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return existing.id as string;

    const { data, error } = await this.supabase
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
      const { error: uploadError } = await this.supabase.storage
        .from('neya-audio')
        .upload(audioPath, audio, {
          contentType: audio.type.split(';')[0] || 'audio/webm',
          upsert: false,
        });
      if (uploadError) throw uploadError;
    }

    const { data, error } = await this.supabase
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
        const { error: cleanupError } = await this.supabase.storage.from('neya-audio').remove([audioPath]);
        if (cleanupError) {
          throw new Error(`${error.message}. The uploaded audio could not be removed: ${cleanupError.message}`);
        }
      }
      throw error;
    }
    return this.withAudioUrl(data as PlatformMessage);
  }

  async patientConversation(doctorId: string): Promise<PlatformConversation | null> {
    const user = await this.ensureVisitorSession();
    const { data, error } = await this.supabase
      .from('conversations')
      .select('id,patient_id,doctor_id,structure_id,created_at')
      .eq('patient_id', user.id)
      .eq('doctor_id', doctorId)
      .maybeSingle();
    if (error) throw error;
    return data as PlatformConversation | null;
  }

  async conversationMessages(conversationId: string): Promise<PlatformMessage[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('id,conversation_id,sender_id,content,audio_path,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at');
    if (error) throw error;
    return Promise.all((data as PlatformMessage[]).map((message) => this.withAudioUrl(message)));
  }

  async doctorConversations(): Promise<PlatformConversation[]> {
    const { data, error } = await this.supabase
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
      messages: await this.conversationMessages(conversation.id),
    })));
  }

  async sendDoctorReply(conversationId: string, content: string): Promise<void> {
    const user = await this.supabase.auth.getUser();
    if (user.error) throw user.error;
    if (!user.data.user) throw new Error('You must be signed in to reply.');
    const { error } = await this.supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.data.user.id,
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
    const user = await this.supabase.auth.getUser();
    if (user.error) throw user.error;
    const profile = await this.currentProfile();
    if (!user.data.user || !profile?.structure_id) throw new Error('A doctor profile is required to upload a video.');
    const storagePath = `${profile.structure_id}/${user.data.user.id}/${crypto.randomUUID()}`;
    const { error: uploadError } = await this.supabase.storage
      .from('neya-videos')
      .upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
    if (uploadError) throw uploadError;

    const { error } = await this.supabase.from('videos').insert({
      doctor_id: user.data.user.id,
      structure_id: profile.structure_id,
      title: input.title.trim(),
      description: input.description.trim(),
      language: input.language,
      storage_path: storagePath,
      published: true,
    });
    if (error) {
      const { error: cleanupError } = await this.supabase.storage.from('neya-videos').remove([storagePath]);
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
  }> {
    const user = await this.supabase.auth.getUser();
    if (user.error) throw user.error;
    if (!user.data.user) throw new Error('Sign in to view the structure dashboard.');
    const { data: structure, error: structureError } = await this.supabase
      .from('structures')
      .select('id,name,city,phone,address,approval_status')
      .eq('owner_id', user.data.user.id)
      .maybeSingle();
    if (structureError) throw structureError;
    if (!structure) return { structure: null, doctors: [], videos: [], bookings: [], screenings: [] };

    const [doctorResult, videoResult, bookingResult, screeningResult] = await Promise.all([
      this.supabase.from('profiles')
        .select('id,role,status,display_name,phone,structure_id,specialty,languages,bio')
        .eq('role', 'doctor').eq('structure_id', structure.id),
      this.supabase.from('videos')
        .select('id,doctor_id,structure_id,title,description,language,storage_path,published,created_at')
        .eq('structure_id', structure.id).order('created_at', { ascending: false }),
      this.supabase.from('bookings')
        .select('id,kind,screening_event_id,full_name,phone,slot_label,status,created_at,screening_events(title,starts_at,location)')
        .eq('structure_id', structure.id).order('created_at', { ascending: false }),
      this.supabase.from('screening_events')
        .select('id,structure_id,title,description,starts_at,ends_at,location,free')
        .eq('structure_id', structure.id).order('starts_at'),
    ]);
    const firstError = doctorResult.error ?? videoResult.error ?? bookingResult.error ?? screeningResult.error;
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
        });
        return { ...signedVideo, src: signedVideo.videoUrl ?? '' };
      })),
      bookings: (bookingResult.data ?? []).map((booking) => ({
        ...booking,
        screening_events: Array.isArray(booking.screening_events)
          ? booking.screening_events[0] ?? null
          : booking.screening_events ?? null,
      })) as PlatformBooking[],
      screenings: (screeningResult.data ?? []) as PlatformScreening[],
    };
  }

  async setBookingStatus(id: string, status: 'confirmed' | 'cancelled' | 'completed'): Promise<void> {
    const { error } = await this.supabase.rpc('update_booking_status', {
      p_booking_id: id,
      p_status: status,
    });
    if (error) throw error;
  }

  async createScreening(input: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    location: string;
    free: boolean;
  }): Promise<void> {
    const user = await this.supabase.auth.getUser();
    if (user.error) throw user.error;
    if (!user.data.user) throw new Error('Sign in to manage screenings.');
    const { data: structure, error: structureError } = await this.supabase
      .from('structures')
      .select('id')
      .eq('owner_id', user.data.user.id)
      .single();
    if (structureError) throw structureError;
    const { error } = await this.supabase.from('screening_events').insert({
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

  async interpretResult(result: OrientationResult, language: Lang): Promise<string> {
    await this.ensureVisitorSession();
    const { data, error } = await this.supabase.functions.invoke('explain-result', {
      body: {
        language,
        result: {
          level: result.level,
          title: result.title,
          message: result.message,
          reasons: result.reasons,
        },
      },
    });
    if (error) throw error;
    if (typeof data?.explanation !== 'string') throw new Error('The AI returned an invalid explanation.');
    return data.explanation;
  }

  subscribeToConversation(
    conversationId: string,
    onMessage: (message: PlatformMessage) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const channel = this.supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          void this.withAudioUrl(payload.new as PlatformMessage)
            .then(onMessage)
            .catch((error: unknown) => onError?.(
              error instanceof Error ? error : new Error('Could not load a new message.'),
            ));
        },
      )
      .subscribe();
    return () => {
      void this.supabase.removeChannel(channel);
    };
  }

  private async withAudioUrl(message: PlatformMessage): Promise<PlatformMessage> {
    if (!message.audio_path) return message;
    const { data, error } = await this.supabase.storage
      .from('neya-audio')
      .createSignedUrl(message.audio_path, 60 * 60);
    if (error) throw error;
    return { ...message, audioUrl: data.signedUrl };
  }

  private async withVideoUrl(video: PlatformVideo): Promise<PlatformVideo> {
    const { data, error } = await this.supabase.storage
      .from('neya-videos')
      .createSignedUrl(video.storage_path, 60 * 60);
    if (error) throw error;
    return { ...video, videoUrl: data.signedUrl };
  }
}
