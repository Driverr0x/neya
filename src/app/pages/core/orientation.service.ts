import { Injectable } from '@angular/core';
import { PROFESSIONALS, hasConcerningSymptoms } from './data';
import { Answers, Lang, OrientationResult, Professional, Specialty } from './models';

@Injectable({ providedIn: 'root' })
export class OrientationService {
  async orient(answers: Answers): Promise<OrientationResult> {
    const symptoms = hasConcerningSymptoms(answers);
    const level: OrientationResult['level'] = symptoms ? 3 : answers.age && answers.age >= 50 ? 2 : 1;

    return {
      level,
      title: level === 3 ? 'Demandez un avis médical' : level === 2 ? 'Un échange peut vous aider' : 'Continuez à vous informer',
      message:
        level === 3
          ? 'Un changement vous inquiète : prenez rendez-vous avec un professionnel de santé pour en parler.'
          : level === 2
            ? 'Vous pouvez échanger avec un professionnel de santé sur le dépistage adapté à votre situation.'
            : 'Poursuivez votre information et contactez un professionnel si vous avez une question ou une inquiétude.',
      reasons: symptoms
        ? ['Vous avez indiqué avoir remarqué un changement.']
        : ['Cette orientation repose uniquement sur vos réponses au questionnaire.'],
      specialty: level >= 2 ? 'sage-femme' : null,
      language: (answers.language as Lang | undefined) ?? 'fr',
      videoId: 'depistage',
      source: 'rules',
    };
  }

  rankPros(
    specialty: Specialty | null,
    language: Lang,
    city?: string,
  ): Professional[] {
    const normalizedCity = city?.toLocaleLowerCase();
    return PROFESSIONALS.map((professional, index) => ({
      professional,
      index,
      score:
        (professional.specialty === specialty ? 4 : 0) +
        (professional.langs.includes(language) ? 2 : 0) +
        (professional.city.toLocaleLowerCase() === normalizedCity ? 1 : 0),
    }))
      .sort((first, second) => second.score - first.score || first.index - second.index)
      .map(({ professional }) => professional);
  }
}
