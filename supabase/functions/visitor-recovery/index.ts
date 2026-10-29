import { handleOptions, jsonResponse, serviceClient, sha256, verifiedUser, errorMessage } from '../_shared/http.ts';

// Sans 0/O, 1/I/L ni U : un code recopié à la main ne se confond pas.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 16;

/** NEYA-XXXX-XXXX-XXXX-XXXX : environ 78 bits d'aléa. */
function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH * 2));
  const chars: string[] = [];
  for (const byte of bytes) {
    // Rejet des valeurs hors plage pour une répartition uniforme.
    if (byte >= 240) continue;
    chars.push(ALPHABET[byte % ALPHABET.length]);
    if (chars.length === CODE_LENGTH) break;
  }
  if (chars.length < CODE_LENGTH) return newCode();
  const groups = chars.join('').match(/.{4}/g) ?? [];
  return ['NEYA', ...groups].join('-');
}

/** Tolère minuscules, espaces, tirets et le préfixe NEYA. */
function normalize(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^NEYA/, '');
}

async function issueCode(admin: ReturnType<typeof serviceClient>, userId: string): Promise<string> {
  const code = newCode();
  const { error } = await admin.from('visitor_recovery_codes').upsert({
    user_id: userId,
    code_hash: await sha256(normalize(code)),
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  return code;
}

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const user = await verifiedUser(request);
    if (!user.is_anonymous) return jsonResponse({ error: 'Recovery is only available for visitor sessions' }, 403);
    const body = await request.json().catch(() => ({}));
    const admin = serviceClient();

    if (body.action === 'create') {
      // Un nouveau code remplace l'ancien.
      return jsonResponse({ code: await issueCode(admin, user.id) }, 201);
    }

    if (body.action === 'redeem') {
      const code = typeof body.code === 'string' ? normalize(body.code) : '';
      if (code.length !== CODE_LENGTH) return jsonResponse({ error: 'Recovery code is invalid' }, 400);

      const { data: allowed, error: limitError } = await admin.rpc('consume_recovery_attempt', { p_user_id: user.id });
      if (limitError) throw limitError;
      if (!allowed) return jsonResponse({ error: 'Too many recovery attempts, please wait' }, 429);

      const { data: owner, error: findError } = await admin
        .from('visitor_recovery_codes')
        .select('user_id')
        .eq('code_hash', await sha256(code))
        .maybeSingle();
      if (findError) throw findError;
      if (!owner) return jsonResponse({ error: 'Recovery code not found' }, 404);
      if (owner.user_id === user.id) return jsonResponse({ error: 'Recovery code belongs to this phone' }, 409);

      const { data: moved, error: transferError } = await admin.rpc('transfer_visitor_data', {
        p_from: owner.user_id,
        p_to: user.id,
      });
      if (transferError) throw transferError;

      // L'ancienne session anonyme ne contient plus rien : on la supprime.
      const { error: deleteError } = await admin.auth.admin.deleteUser(owner.user_id);
      if (deleteError) console.error('Old visitor session could not be deleted:', deleteError.message);

      // Le code utilisé ne sert qu'une fois : on en remet un nouveau à la visiteuse.
      return jsonResponse({ moved, code: await issueCode(admin, user.id) });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('Visitor recovery failed:', error);
    return jsonResponse({ error: errorMessage(error, 'Visitor recovery failed') }, 400);
  }
});
