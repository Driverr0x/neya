import { Injectable } from '@angular/core';
import { BackendService } from './backend.service';
import { Lang, OrientationResult } from './models';

@Injectable({ providedIn: 'root' })
export class ResultInterpretationService {
  constructor(private readonly backend: BackendService) {}

  get aiAvailable(): boolean {
    return this.backend.configured;
  }

  async interpret(result: OrientationResult): Promise<string> {
    switch (result.level) {
      case 3:
        return 'Vous avez remarqué un changement qui vous inquiète. Cela ne veut pas dire que vous avez un cancer, mais il est important d’en parler à un professionnel de santé.';
      case 2:
        return 'Un échange avec un professionnel de santé peut vous aider à choisir le dépistage adapté à votre situation. Ce résultat n’est pas un diagnostic.';
      case 1:
        return 'D’après vos réponses, vous pouvez continuer à vous informer. Si vous remarquez un changement ou si vous êtes inquiète, parlez-en à un professionnel de santé.';
    }
  }

  async interpretWithAi(result: OrientationResult, language: Lang): Promise<string> {
    return this.backend.interpretResult(result, language);
  }
}
