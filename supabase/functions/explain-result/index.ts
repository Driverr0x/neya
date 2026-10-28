import { handleOptions, jsonResponse, serviceClient, verifiedUser } from '../_shared/http.ts';

const languageNames: Record<string, string> = {
  fr: 'français simple',
  moore: 'mooré',
  dioula: 'dioula',
};

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const user = await verifiedUser(request);
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'AI interpretation is not configured on the server' }, 503);

    const body = await request.json();
    const result = body.result;
    const language = typeof body.language === 'string' ? body.language : 'fr';
    if (!result || ![1, 2, 3].includes(result.level) ||
      typeof result.title !== 'string' || result.title.length > 160 ||
      typeof result.message !== 'string' || result.message.length > 1200 ||
      !Array.isArray(result.reasons) || result.reasons.length > 8 ||
      result.reasons.some((reason: unknown) => typeof reason !== 'string' || reason.length > 240) ||
      !Object.hasOwn(languageNames, language)) {
      return jsonResponse({ error: 'Invalid result payload' }, 400);
    }

    const admin = serviceClient();
    const { data: allowed, error: limitError } = await admin.rpc('consume_ai_request', {
      p_user_id: user.id,
    });
    if (limitError) throw limitError;
    if (!allowed) return jsonResponse({ error: 'Please wait before requesting another AI explanation' }, 429);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
          temperature: 0.2,
          max_tokens: 180,
          messages: [
            {
              role: 'system',
              content: `Reformule uniquement le résultat de dépistage fourni en langage simple. Ne pose jamais de diagnostic, ne donne pas de traitement et ne modifie pas le niveau ou l’orientation médicale. Rappelle que seul un professionnel de santé peut poser un diagnostic. Réponds en ${languageNames[language]}.`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                language,
                level: result.level,
                title: result.title,
                message: result.message,
                reasons: result.reasons,
              }),
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error('AI provider request failed:', response.status);
      return jsonResponse({ error: 'AI interpretation is temporarily unavailable' }, 502);
    }

    const completion = await response.json();
    const explanation = completion.choices?.[0]?.message?.content;
    if (typeof explanation !== 'string' || !explanation.trim() || explanation.length > 1200) {
      return jsonResponse({ error: 'AI provider returned an invalid response' }, 502);
    }
    return jsonResponse({ explanation: explanation.trim() });
  } catch (error) {
    console.error('Result interpretation failed:', error);
    const message = error instanceof Error ? error.message : 'Result interpretation failed';
    return jsonResponse({ error: message }, 400);
  }
});
