import { OrientationResult } from './models';
import { ResultInterpretationService } from './result-interpretation.service';
import { BackendService } from './backend.service';

describe('ResultInterpretationService', () => {
  let service: ResultInterpretationService;

  const resultAtLevel = (level: OrientationResult['level']): OrientationResult => ({
    level,
    title: '',
    message: '',
    reasons: [],
    specialty: null,
    language: 'fr',
    videoId: '',
    source: 'rules',
  });

  beforeEach(() => {
    service = new ResultInterpretationService({} as BackendService);
  });

  it('explains a concerning result without presenting it as a diagnosis', async () => {
    const explanation = await service.interpret(resultAtLevel(3));

    expect(explanation).toContain('professionnel de santé');
    expect(explanation).toContain('ne veut pas dire que vous avez un cancer');
  });

  it('explains all orientation levels in simple language', async () => {
    await expect(service.interpret(resultAtLevel(2))).resolves.toContain(
      'dépistage adapté',
    );
    await expect(service.interpret(resultAtLevel(1))).resolves.toContain(
      'continuer à vous informer',
    );
  });
});
