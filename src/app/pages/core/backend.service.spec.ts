import { BackendService } from './backend.service';

describe('BackendService configuration', () => {
  it('reports when the public Supabase settings have not been provided', () => {
    const service = new BackendService();

    expect(service.configured).toBe(false);
    expect(() => service.supabase).toThrowError(/Supabase is not configured/);
  });
});
