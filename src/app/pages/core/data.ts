import {
  Answers,
  Lang,
  Professional,
  Question,
  ScreeningEvent,
  Specialty,
  Structure,
  TalkingTile,
  Video,
} from './models';

export const LANG_LABEL: Record<Lang, string> = {
  fr: 'Français',
  en: 'English',
  moore: 'Mooré',
  dioula: 'Dioula',
};

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && Object.hasOwn(LANG_LABEL, value);
}

/** Ordre de la boucle d'accueil : chaque langue est prononcée dans sa propre langue. */
export const LANGUAGE_TILES: TalkingTile[] = [
  { id: 'fr', label: 'Français', audio: 'fr/langue', fallback: { text: 'Français', lang: 'fr' }, icon: 'chatbubble-ellipses-outline' },
  { id: 'en', label: 'English', audio: 'en/langue', fallback: { text: 'English', lang: 'en' }, icon: 'chatbubble-ellipses-outline' },
  { id: 'moore', label: 'Mooré', audio: 'moore/langue', icon: 'chatbubble-ellipses-outline' },
  { id: 'dioula', label: 'Dioula', audio: 'dioula/langue', icon: 'chatbubble-ellipses-outline' },
];

export const SPECIALTY_LABEL: Record<Specialty, string> = {
  'sage-femme': 'Sage-femme',
  medecin: 'Médecin',
  psychologue: 'Psychologue',
};

/**
 * Vidéos de NEYA intégrées à l'application : elles marchent sans connexion.
 * Les vidéos publiées par les médecins s'y ajoutent quand le serveur est joignable.
 * Fichiers compressés (H.264 720p, environ 0,5 Mb/s) : les originaux restent hors du dépôt, dans media/.
 */
export const VIDEOS: Video[] = [
  {
    id: 'sensibilisation',
    title: 'Comprendre le dépistage du cancer du sein',
    author: 'Équipe de santé NEYA',
    duration: '2 min 17',
    lang: 'fr',
    src: 'assets/videos/sensibilisation-cancer-sein.mp4',
    poster: 'assets/videos/sensibilisation-cancer-sein.jpg',
    description:
      'Une présentation générale du dépistage, des signes à surveiller et des façons de demander conseil à un professionnel de santé.',
  },
];

const choice = (value: string | number, label: string, icon: string, image?: string) => ({
  value,
  label,
  icon,
  image,
});

const symptomImage = (name: string) => `assets/symptoms/${name}.png`;

export const QUESTIONS: Question[] = [
  {
    id: 'age',
    title: 'Quel âge avez-vous ?',
    hint: 'Cette information aide à vous orienter. Elle ne permet pas d’établir un diagnostic.',
    options: [
      choice(25, 'Moins de 30 ans', 'person-outline'),
      choice(35, 'Entre 30 et 49 ans', 'person-outline'),
      choice(50, '50 ans ou plus', 'person-outline'),
    ],
  },
  {
    id: 'symptoms',
    title: 'Avez-vous remarqué un changement qui vous inquiète ?',
    hint: 'Touchez une image quand elle s’allume, confirmez, puis appuyez sur Continuer.',
    multi: true,
    options: [
      choice('lump', 'Une boule ou une grosseur', 'ellipse-outline', symptomImage('lump')),
      choice('orange-peel', 'Peau d’orange', 'grid-outline', symptomImage('orange-peel')),
      choice('discharge', 'Écoulement anormal', 'water-outline', symptomImage('discharge')),
      choice('change', 'Un mamelon qui rentre ou change', 'alert-circle-outline', symptomImage('nipple')),
      choice('pain', 'Une douleur persistante', 'heart-outline', symptomImage('pain')),
      choice('none', 'Pas de symptômes', 'close-circle-outline', symptomImage('none')),
    ],
  },
  {
    id: 'language',
    title: 'Dans quelle langue préférez-vous échanger ?',
    options: [
      choice('fr', 'Français', 'chatbubble-outline'),
      choice('en', 'English', 'chatbubble-outline'),
      choice('moore', 'Mooré', 'chatbubble-outline'),
      choice('dioula', 'Dioula', 'chatbubble-outline'),
    ],
  },
  {
    id: 'city',
    title: 'Dans quelle ville souhaitez-vous être orientée ?',
    hint: 'Choisissez la ville la plus proche de vous.',
    options: [
      choice('Ouagadougou', 'Ouagadougou', 'location-outline'),
      choice('Bobo-Dioulasso', 'Bobo-Dioulasso', 'location-outline'),
    ],
  },
];

export const STRUCTURES: Structure[] = [
  {
    id: 'centre-ouaga',
    name: 'Centre de santé Wend-Kuuni',
    city: 'Ouagadougou',
    hours: 'Lun–Ven, 8 h–16 h',
    phone: '+226 25 30 00 01',
    services: ['Dépistage', 'Consultation', 'Sage-femme'],
    slots: [
      { id: 'ouaga-1', label: 'Demain, 9 h' },
      { id: 'ouaga-2', label: 'Demain, 14 h' },
    ],
  },
  {
    id: 'centre-bobo',
    name: 'Centre médical de Dafra',
    city: 'Bobo-Dioulasso',
    hours: 'Lun–Sam, 8 h–17 h',
    phone: '+226 20 97 00 02',
    services: ['Dépistage', 'Consultation'],
    slots: [
      { id: 'bobo-1', label: 'Mercredi, 10 h' },
      { id: 'bobo-2', label: 'Jeudi, 15 h' },
    ],
  },
];

export const PROFESSIONALS: Professional[] = [
  {
    id: 'pro-aminata',
    name: 'Aminata Sawadogo',
    specialty: 'sage-femme',
    structure: 'Centre de santé Wend-Kuuni',
    city: 'Ouagadougou',
    langs: ['fr', 'moore'],
    responseDelay: 'sous 24 h',
    phone: '+226 25 30 00 01',
    bio: 'Sage-femme proposant des consultations de prévention et d’orientation.',
  },
  {
    id: 'pro-mariam',
    name: 'Mariam Traoré',
    specialty: 'medecin',
    structure: 'Centre médical de Dafra',
    city: 'Bobo-Dioulasso',
    langs: ['fr', 'dioula'],
    responseDelay: 'sous 48 h',
    phone: '+226 20 97 00 02',
    bio: 'Médecin généraliste disponible pour une première consultation et une orientation.',
  },
  {
    id: 'pro-adama',
    name: 'Adama Kaboré',
    specialty: 'psychologue',
    structure: 'Centre de santé Wend-Kuuni',
    city: 'Ouagadougou',
    langs: ['fr', 'moore', 'dioula'],
    responseDelay: 'sous 48 h',
    phone: '+226 25 30 00 03',
    bio: 'Professionnel à l’écoute pour un accompagnement et un soutien psychologique.',
  },
];

export function screeningsThisMonth(): ScreeningEvent[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcomingDays = [5, 15, 25].filter((day) => day >= today.getDate());
  return upcomingDays.map((day, index) => ({
    id: `screening-${index}`,
    structureId: index % 2 === 0 ? 'centre-ouaga' : 'centre-bobo',
    date: new Date(now.getFullYear(), now.getMonth(), day),
    time: index % 2 === 0 ? '9 h–12 h' : '14 h–17 h',
    title: index % 2 === 0 ? 'Matinée de dépistage' : 'Information et dépistage',
    free: true,
  }));
}

export function hasConcerningSymptoms(answers: Answers): boolean {
  const symptoms = answers.symptoms ?? [];
  return symptoms.some((symptom) => symptom !== 'none');
}
