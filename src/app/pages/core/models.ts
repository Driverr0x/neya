export type Lang = 'fr' | 'en' | 'moore' | 'dioula';

export type Specialty = 'sage-femme' | 'medecin' | 'psychologue';

export interface Video {
  id: string;
  title: string;
  author: string;
  duration: string;
  lang: Lang;
  src: string;
  /** Image affichée avant la lecture : rien n'est téléchargé tant qu'on n'appuie pas sur lecture. */
  poster?: string;
  description: string;
}

export interface Professional {
  id: string;
  name: string;
  specialty: Specialty;
  structure: string;
  city: string;
  langs: Lang[];
  responseDelay: string;
  phone: string;
  bio: string;
}

export interface Structure {
  id: string;
  name: string;
  city: string;
  hours: string;
  phone: string;
  services: string[];
  slots: { id: string; label: string }[];
}

export interface Answers {
  [key: string]: string | number | string[] | undefined;
  language?: Lang;
  city?: string;
  age?: number;
  symptoms?: string[];
}

export interface QuestionOption {
  value: string | number;
  label: string;
  icon: string;
  image?: string;
}

/** Tuile parlante : elle s'allume, affiche son mot et le prononce à son tour dans la boucle. */
export interface TalkingTile {
  id: string;
  label: string;
  /** Enregistrement préenregistré, relatif à assets/audio/ et sans extension (ex. « moore/langue »). */
  audio: string;
  /** Lecture par synthèse vocale tant que l'enregistrement n'existe pas (fr et en uniquement). */
  fallback?: { text: string; lang: Lang };
  icon?: string;
  image?: string;
  /** Tuile « croix » (aucun symptôme). */
  none?: boolean;
}

export interface Question {
  id: string;
  title: string;
  hint?: string;
  multi?: boolean;
  showIf?: (answers: Answers) => boolean;
  options: QuestionOption[];
}

export interface OrientationResult {
  level: 1 | 2 | 3;
  title: string;
  message: string;
  reasons: string[];
  specialty: Specialty | null;
  language: Lang;
  videoId: string;
  source: 'rules' | 'ai';
  simpleExplanation?: string;
  explanationSource?: 'rules' | 'ai';
  at?: number;
  /** Résumé envoyé à une structure avec l'accord de l'utilisatrice. */
  referral?: { structureName: string; at: number };
}

/** Demande à envoyer à Supabase (rendez-vous ou inscription à un dépistage). */
export interface BookingPayload {
  structureId: string;
  kind: 'appointment' | 'screening';
  fullName: string;
  phone: string;
  slotLabel?: string;
  screeningEventId?: string;
}

export interface QueueItem {
  id: string;
  kind: 'appointment' | 'message';
  status: 'pending' | 'sent';
  /** Présent tant que la demande attend d'être envoyée au serveur ; retiré une fois envoyée. */
  booking?: BookingPayload;
  /** Dernier échec d'envoi, affiché à l'utilisatrice. */
  error?: string;
  name?: string;
  proName?: string;
  proId?: string;
  structureId?: string;
  slot?: string;
  mode?: 'cabinet' | 'remote';
}

export interface ChatMessage {
  id: string;
  proId: string;
  type: 'text' | 'audio';
  content: string;
  audioUrl?: string;
  createdAt: Date;
  status: 'pending' | 'sent';
}

export interface ScreeningEvent {
  id: string;
  structureId: string;
  date: Date;
  time: string;
  title: string;
  free: boolean;
}
