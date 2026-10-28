import {
  Answers,
  Lang,
  Professional,
  Question,
  ScreeningEvent,
  Specialty,
  Structure,
  Video,
} from './models';

export const LANG_LABEL: Record<Lang, string> = {
  fr: 'Français',
  moore: 'Mooré',
  dioula: 'Dioula',
};

export const SPECIALTY_LABEL: Record<Specialty, string> = {
  'sage-femme': 'Sage-femme',
  medecin: 'Médecin',
  psychologue: 'Psychologue',
};

export const VIDEOS: Video[] = [
  {
    id: 'depistage',
    title: 'Comprendre le dépistage du cancer du sein',
    author: 'Équipe de santé NEYA',
    duration: '4 min',
    lang: 'fr',
    src: 'assets/VID_20261014_000748.mp4',
    description:
      'Une présentation générale du dépistage, des signes à surveiller et des façons de demander conseil à un professionnel de santé.',
  },
  {
    id: 'signes',
    title: 'Les signes qui doivent amener à consulter',
    author: 'Équipe de santé NEYA',
    duration: '3 min',
    lang: 'fr',
    src: 'assets/VID_20261014_000748.mp4',
    description:
      'Apprenez à reconnaître les changements qui justifient de demander un avis médical, sans remplacer un examen professionnel.',
  },
  {
    id: 'prevention',
    title: 'Prévention et suivi',
    author: 'Équipe de santé NEYA',
    duration: '5 min',
    lang: 'moore',
    src: 'assets/VID_20261014_000748.mp4',
    description:
      'Des informations pratiques pour parler de prévention et de suivi avec un professionnel de santé.',
  },
  {
    id: 'conseils',
    title: 'Conseils pour prendre soin de sa santé',
    author: 'Équipe de santé NEYA',
    duration: '4 min',
    lang: 'dioula',
    src: 'assets/VID_20261014_000748.mp4',
    description:
      'Des repères simples pour préparer une consultation et trouver un service de santé adapté.',
  },
];

const choice = (value: string | number, label: string, icon: string) => ({
  value,
  label,
  icon,
});

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
    hint: 'Sélectionnez tout ce qui s’applique, puis appuyez sur Continuer.',
    multi: true,
    options: [
      choice('lump', 'Une boule ou une grosseur', 'ellipse-outline'),
      choice('change', 'Un changement de peau ou du mamelon', 'alert-circle-outline'),
      choice('pain', 'Une douleur persistante', 'heart-outline'),
      choice('none', 'Non, aucun changement remarqué', 'checkmark-circle-outline'),
    ],
  },
  {
    id: 'language',
    title: 'Dans quelle langue préférez-vous échanger ?',
    options: [
      choice('fr', 'Français', 'chatbubble-outline'),
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
