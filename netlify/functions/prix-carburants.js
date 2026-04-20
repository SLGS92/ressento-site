// Netlify Function — proxy API prix carburants gouvernementale
// Calcule les moyennes nationales à partir du flux instantané
// Appelée depuis le front : /.netlify/functions/prix-carburants

const DATASET = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';

// Prix de référence avant crise (27 février 2026)
const PRIX_AVANT_CRISE = {
  gazole: 1.698,
  sp95:   1.779,
  e85:    0.782
};

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600' // cache 1h
  };

  try {
    // On tire un échantillon représentatif : 100 stations avec prix non nuls
    const params = new URLSearchParams({
      limit: 100,
      select: 'prix_gazole,prix_sp95,prix_e85',
      where: 'prix_gazole > 0 AND prix_sp95 > 0',
      order_by: 'RANDOM()'
    });

    const res = await fetch(`${DATASET}?${params}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    const records = data.results || [];

    if (records.length === 0) throw new Error('No records returned');

    // Calcul des moyennes
    const moyenne = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const gazole = records.map(r => parseFloat(r.prix_gazole)).filter(v => v > 1 && v < 4);
    const sp95   = records.map(r => parseFloat(r.prix_sp95)).filter(v => v > 1 && v < 4);
    const e85    = records.map(r => parseFloat(r.prix_e85)).filter(v => v > 0.5 && v < 2);

    const prix = {
      gazole: gazole.length > 0 ? Math.round(moyenne(gazole) * 1000) / 1000 : null,
      sp95:   sp95.length > 0   ? Math.round(moyenne(sp95) * 1000) / 1000   : null,
      e85:    e85.length > 0    ? Math.round(moyenne(e85) * 1000) / 1000    : null,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        prix,
        avant_crise: PRIX_AVANT_CRISE,
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        source: 'prix-carburants.gouv.fr',
        echantillon: records.length
      })
    };

  } catch (err) {
    // Fallback sur les prix du 20 avril 2026 si l'API est indisponible
    console.error('Erreur API carburants:', err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        prix: { gazole: 2.163, sp95: 2.002, e85: 0.827 },
        avant_crise: PRIX_AVANT_CRISE,
        date: '20 avril 2026',
        source: 'fallback',
        echantillon: 0
      })
    };
  }
};
