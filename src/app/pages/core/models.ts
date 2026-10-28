export type Lang = 'fr' | 'moore' | 'dioula';

export type Specialty = 'sage-femme' | 'medecin' | 'psychologue';

export interface Video {
  id: string;
  title: string;
  author: string;
  duration: string;
  lang: Lang;
  src: string;
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
}

export interface QueueItem {
  id: string;
  kind: 'appointment' | 'message';
  status: 'pending' | 'sent';
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
