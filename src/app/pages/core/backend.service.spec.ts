import { environment } from '../../../environments/environment';
import { BackendService } from './backend.service';

describe('BackendService configuration', () => {
  it('follows the public Supabase settings of the environment', () => {
    const service = new BackendService();
    const expected = Boolean(environment.supabaseUrl && environment.supabaseAnonKey);

    expect(service.configured).toBe(expected);
    if (expected) {
      // Deux sessions séparées : visiteuse (anonyme) et espace professionnel.
      expect(service.visitor).not.toBe(service.pro);
    } else {
      expect(() => service.visitor).toThrowError(/Supabase is not configured/);
      expect(() => service.pro).toThrowError(/Supabase is not configured/);
    }
  });
});
