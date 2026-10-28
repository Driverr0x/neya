import { handleOptions, jsonResponse, serviceClient, sha256, verifiedUser } from '../_shared/http.ts';

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const user = await verifiedUser(request);
    if (user.is_anonymous) return jsonResponse({ error: 'A verified account is required' }, 403);
    const admin = serviceClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role,status')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== 'structure_admin' || profile.status !== 'active') {
      return jsonResponse({ error: 'Only a structure manager can invite doctors' }, 403);
    }

    const { data: structure, error: structureError } = await admin
      .from('structures')
      .select('id,approval_status')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (structureError) throw structureError;
    if (!structure || structure.approval_status !== 'approved') {
      return jsonResponse({ error: 'The structure must be verified before inviting doctors' }, 403);
    }

    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const inviteCode = btoa(String.fromCharCode(...tokenBytes))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
    const { error: insertError } = await admin.from('doctor_invites').insert({
      token_hash: await sha256(inviteCode),
      structure_id: structure.id,
      created_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (insertError) throw insertError;
    return jsonResponse({ inviteCode, expiresInDays: 7 }, 201);
  } catch (error) {
    console.error('Doctor invitation creation failed:', error);
    const message = error instanceof Error ? error.message : 'Could not create invitation';
    return jsonResponse({ error: message }, 400);
  }
});
