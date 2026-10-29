import { handleOptions, jsonResponse, serviceClient, sha256, verifiedUser, errorMessage } from '../_shared/http.ts';

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const user = await verifiedUser(request);
    if (user.is_anonymous) return jsonResponse({ error: 'A verified account is required' }, 403);

    const body = await request.json();
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : '';
    const specialty = body.specialty;
    const languages = body.languages;
    const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';
    if (displayName.length < 2 || displayName.length > 120 || phone.length > 32 ||
      inviteCode.length < 24 || inviteCode.length > 128) {
      return jsonResponse({ error: 'Please provide a valid name, phone, and invitation code' }, 400);
    }
    if (orderNumber.length < 3 || orderNumber.length > 40) {
      return jsonResponse({ error: 'Please provide a valid order number' }, 400);
    }
    if (!['sage-femme', 'medecin', 'psychologue'].includes(specialty) ||
      !Array.isArray(languages) || languages.length === 0 || languages.length > 3 ||
      languages.some((language: unknown) => !['fr', 'moore', 'dioula'].includes(String(language))) ||
      bio.length > 1000) {
      return jsonResponse({ error: 'Please provide a valid specialty, language, and biography' }, 400);
    }

    const admin = serviceClient();
    const { data: structureId, error } = await admin.rpc('redeem_doctor_invite', {
      p_user_id: user.id,
      p_token_hash: await sha256(inviteCode),
      p_display_name: displayName,
      p_phone: phone,
      p_specialty: specialty,
      p_languages: languages,
      p_bio: bio,
      p_order_number: orderNumber,
    });
    if (error) throw error;
    return jsonResponse({ structureId, role: 'doctor' }, 201);
  } catch (error) {
    console.error('Doctor registration failed:', error);
    const message = errorMessage(error, 'Doctor registration failed');
    return jsonResponse({ error: message }, 400);
  }
});
