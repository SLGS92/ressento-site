// netlify/functions/subscribe.js
// Brevo (ex-Sendinblue) subscription handler for Ressento
// Deploy to: netlify/functions/subscribe.js
//
// Required environment variable in Netlify dashboard:
//   BREVO_API_KEY = your Brevo API key (never put it in code)
//
// Replace XX below with your actual Brevo list ID before committing

const LIST_ID = 4;

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': 'https://ressento.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Parse body
  let email, source;
  try {
    const body = JSON.parse(event.body);
    email = body.email?.trim().toLowerCase();
    source = body.source || 'site';
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Validate email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  // Call Brevo API
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('[Ressento] BREVO_API_KEY not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email,
        listIds: [LIST_ID],
        updateEnabled: true, // update if contact already exists
        attributes: {
          SOURCE: source,
          SIGNUP_DATE: new Date().toISOString().split('T')[0]
        }
      })
    });

    // 201 = created, 204 = already exists and updated
    if (response.status === 201 || response.status === 204) {
      console.log(`[Ressento] Subscribed: ${email} (source: ${source})`);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // Handle "already in list" case from Brevo (400 with code 'duplicate_parameter')
    const data = await response.json();
    if (data.code === 'duplicate_parameter') {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, already: true }) };
    }

    console.error('[Ressento] Brevo error:', data);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Subscription failed' }) };

  } catch (err) {
    console.error('[Ressento] Fetch error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Network error' }) };
  }
};
