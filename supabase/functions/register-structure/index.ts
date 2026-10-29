import { handleOptions, jsonResponse, serviceClient, verifiedUser, errorMessage } from '../_shared/http.ts';

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const user = await verifiedUser(request);
    if (user.is_anonymous) return jsonResponse({ error: 'A verified account is required' }, 403);

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    if (name.length < 2 || name.length > 160 || city.length < 2 || city.length > 100 ||
      phone.length < 5 || phone.length > 32 || address.length > 240) {
      return jsonResponse({ error: 'Please provide a valid name, city, phone, and address' }, 400);
    }

    const admin = serviceClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role,status')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== 'patient' || profile.status !== 'active') {
      return jsonResponse({ error: 'This account cannot register a structure' }, 409);
    }

    const { data: structureId, error } = await admin.rpc('register_structure_account', {
      p_user_id: user.id,
      p_name: name,
      p_city: city,
      p_phone: phone,
      p_address: address,
    });
    if (error) throw error;
    return jsonResponse({
      structureId,
      status: 'pending',
      message: 'Registration received. The structure must be verified before it can use the management area.',
    }, 201);
  } catch (error) {
    console.error('Structure registration failed:', error);
    const message = errorMessage(error, 'Structure registration failed');
    return jsonResponse({ error: message }, 400);
  }
});
