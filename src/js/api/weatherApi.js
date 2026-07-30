/* ==========================================================================
   VÆR OG KLIMA I NORGE - WEATHER API INTEGRATION
   ========================================================================== */

const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/**
 * Henter sanntids- og prognosedata for gitt bredde- og lengdegrad
 */
export async function fetchCurrentAndForecast(lat, lon) {
  const url = `${FORECAST_BASE_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&wind_speed_unit=ms&timezone=auto`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API-feil: ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Kunne ikke hente værdata:', err);
    throw err;
  }
}

/**
 * Søker etter steder i Norge via geocoding API
 */
export async function searchLocation(query) {
  if (!query || query.trim().length < 2) return [];

  const url = `${GEOCODING_BASE_URL}?name=${encodeURIComponent(query)}&count=10&language=no&format=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding feil');
    const data = await res.json();

    if (!data.results) return [];

    // Prioriter steder i Norge eller filtrer for Norge
    const norwayResults = data.results.filter(item => item.country_code === 'NO');
    const results = norwayResults.length > 0 ? norwayResults : data.results;

    return results.map(item => ({
      name: item.name,
      region: item.admin1 || item.admin2 || item.country || 'Norge',
      lat: item.latitude,
      lon: item.longitude,
      elevation: item.elevation
    }));
  } catch (err) {
    console.error('Søkefeil:', err);
    return [];
  }
}

// Representativt utvalg av norske steder over hele landet for Extremes calculation
export const SAMPLE_EXTREME_LOCATIONS = [
  { name: 'Oslo', region: 'Østlandet', lat: 59.9139, lon: 10.7522 },
  { name: 'Bergen', region: 'Vestlandet', lat: 60.3930, lon: 5.3242 },
  { name: 'Trondheim', region: 'Trøndelag', lat: 63.4305, lon: 10.3951 },
  { name: 'Stavanger', region: 'Rogaland', lat: 58.9701, lon: 5.7333 },
  { name: 'Tromsø', region: 'Troms', lat: 69.6489, lon: 18.9551 },
  { name: 'Karasjok', region: 'Finnmark', lat: 69.4719, lon: 25.5188 },
  { name: 'Kautokeino', region: 'Finnmark', lat: 69.0125, lon: 23.0417 },
  { name: 'Røros', region: 'Trøndelag', lat: 62.5747, lon: 11.3842 },
  { name: 'Lindesnes', region: 'Agder', lat: 57.9833, lon: 7.0500 },
  { name: 'Nordkapp', region: 'Finnmark', lat: 71.1702, lon: 25.7831 },
  { name: 'Longyearbyen', region: 'Svalbard', lat: 78.2232, lon: 15.6267 },
  { name: 'Bodø', region: 'Nordland', lat: 67.2804, lon: 14.4050 },
  { name: 'Tafjord', region: 'Møre og Romsdal', lat: 62.2289, lon: 7.4161 },
  { name: 'Gol', region: 'Buskerud', lat: 60.7011, lon: 8.9514 },
  { name: 'Kristiansand', region: 'Agder', lat: 58.1467, lon: 7.9956 },
  { name: 'Ålesund', region: 'Møre og Romsdal', lat: 62.4723, lon: 6.1549 },
  { name: 'Geilo', region: 'Buskerud', lat: 60.5333, lon: 8.2058 },
  { name: 'Flåm', region: 'Vestland', lat: 60.8631, lon: 7.1131 },
  { name: 'Rena', region: 'Innlandet', lat: 61.1347, lon: 11.3644 },
  { name: 'Alta', region: 'Finnmark', lat: 69.9689, lon: 23.2717 },
  { name: 'Dombås', region: 'Innlandet', lat: 62.0747, lon: 9.1242 },
  { name: 'Lofoten (Svolvær)', region: 'Nordland', lat: 68.2342, lon: 14.5681 },
  { name: 'Vardø', region: 'Finnmark', lat: 70.3705, lon: 31.1107 },
  { name: 'Hammerfest', region: 'Finnmark', lat: 70.6634, lon: 23.6821 },
  { name: 'Voss', region: 'Vestland', lat: 60.6286, lon: 6.4137 }
];

import kommunerData from '../../../kommuner_koordinater.json';

const kommuneLookup = new Map();
if (Array.isArray(kommunerData)) {
  kommunerData.forEach(k => {
    if (k.kommune) {
      kommuneLookup.set(k.kommune.toLowerCase().trim(), { lat: k.lat, lon: k.lon });
    }
  });
}

const JSONBIN_URL = 'https://api.jsonbin.io/v3/b/6a6bacc4f5f4af5e29d748d2';
const JSONBIN_ACCESS_KEY = '$2a$10$er/dSLTpHud1ixIQtV50O.lUSWV00Xmw8.yf1jI3fVf9vRy49MYem';

/**
 * Henter sanntids toppliste fra JSONBin.io (med fallback til docs/toppliste.json)
 */
export async function fetchExtremesData() {
  let rawData = null;

  // 1. Prøv å hente sanntids toppliste fra JSONBin.io sky-tjenesten
  try {
    const res = await fetch(`${JSONBIN_URL}/latest?t=${Date.now()}`, {
      headers: {
        'X-Access-Key': JSONBIN_ACCESS_KEY,
        'cache-control': 'no-cache'
      }
    });

    if (res.ok) {
      const jsonBinRes = await res.json();
      rawData = jsonBinRes.record || jsonBinRes;
    }
  } catch (err) {
    console.warn('Kunne ikke hente fra JSONBin.io, prøver lokal fil:', err);
  }

  // 2. Fallback til lokal toppliste.json dersom skyoppslag feiler
  if (!rawData) {
    const possiblePaths = [
      './docs/toppliste.json',
      'docs/toppliste.json',
      './toppliste.json',
      'toppliste.json'
    ];

    for (const path of possiblePaths) {
      try {
        const res = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          rawData = await res.json();
          if (rawData && (rawData.varmest || rawData.warmest)) {
            break;
          }
        }
      } catch (e) {
        // prøv neste sti
      }
    }
  }

  if (rawData) {
    const rawWarmest = rawData.varmest || rawData.warmest || [];
    const rawColdest = rawData.kaldest || rawData.coldest || [];
    const rawWettest = rawData.vaatest || rawData.wettest || [];
    const rawWindiest = rawData.mest_vind || rawData.windiest || [];

    const processItem = (item) => {
      const name = item.navn || item.name || 'Ukjent';
      const cleanName = name.toLowerCase().trim();
      const coords = kommuneLookup.get(cleanName) || {};

      const lat = item.lat !== undefined ? item.lat : (coords.lat !== undefined ? coords.lat : 60.0);
      const lon = item.lon !== undefined ? item.lon : (coords.lon !== undefined ? coords.lon : 10.0);

      const temp = typeof item.temp === 'number' ? item.temp : 0;
      const windSpeed = typeof item.vind === 'number' ? item.vind : (typeof item.windSpeed === 'number' ? item.windSpeed : 0);
      const rainToday = typeof item.regn === 'number' ? item.regn : (typeof item.rainToday === 'number' ? item.rainToday : 0);

      let code = item.code || 0;
      if (!item.code) {
        if (rainToday > 5.0) code = 65;
        else if (rainToday > 2.0) code = 63;
        else if (rainToday > 0.0) code = 61;
        else if (temp <= 0) code = 1;
        else code = 0;
      }

      const region = item.fylke || item.region || 'Kommune';

      return {
        name,
        navn: name,
        fylke: item.fylke || '',
        temp,
        windSpeed,
        vind: windSpeed,
        rainToday,
        regn: rainToday,
        lat,
        lon,
        region,
        code
      };
    };

    const warmest = rawWarmest.map(processItem);
    const coldest = rawColdest.map(processItem);
    const wettest = rawWettest.map(processItem);
    const windiest = rawWindiest.map(processItem);

    let displayTime = '';
    if (rawData.sist_oppdatert) {
      const parts = rawData.sist_oppdatert.split(' ');
      if (parts.length === 2) {
        const timePart = parts[1].substring(0, 5);
        displayTime = timePart;
      } else {
        displayTime = rawData.sist_oppdatert;
      }
    } else {
      displayTime = new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
    }

    return {
      warmest,
      coldest,
      wettest,
      windiest,
      varmest: warmest,
      kaldest: coldest,
      vaatest: wettest,
      mest_vind: windiest,
      timestamp: displayTime,
      sist_oppdatert: rawData.sist_oppdatert
    };
  }

  // Fallback til Open-Meteo sampling hvis toppliste.json mot formodning ikke ble funnet
  try {
    const lats = SAMPLE_EXTREME_LOCATIONS.map(l => l.lat).join(',');
    const lons = SAMPLE_EXTREME_LOCATIONS.map(l => l.lon).join(',');

    const url = `${FORECAST_BASE_URL}?latitude=${lats}&longitude=${lons}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&daily=precipitation_sum&wind_speed_unit=ms&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Kunne ikke hente ekstremdata');
    const rawList = await res.json();

    const list = Array.isArray(rawList) ? rawList : [rawList];

    const processed = SAMPLE_EXTREME_LOCATIONS.map((loc, idx) => {
      const data = list[idx] || {};
      const current = data.current || {};
      const daily = data.daily || {};

      return {
        ...loc,
        temp: current.temperature_2m !== undefined ? current.temperature_2m : 0,
        rainToday: daily.precipitation_sum && daily.precipitation_sum[0] !== undefined ? daily.precipitation_sum[0] : (current.precipitation || 0),
        windSpeed: current.wind_speed_10m !== undefined ? current.wind_speed_10m : 0,
        code: current.weather_code || 0
      };
    });

    const warmest = [...processed].sort((a, b) => b.temp - a.temp).slice(0, 10);
    const coldest = [...processed].sort((a, b) => a.temp - b.temp).slice(0, 10);
    const wettest = [...processed].sort((a, b) => b.rainToday - a.rainToday).slice(0, 10);
    const windiest = [...processed].sort((a, b) => b.windSpeed - a.windSpeed).slice(0, 10);

    return {
      warmest,
      coldest,
      wettest,
      windiest,
      timestamp: new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err) {
    console.error('Feil ved uthenting av ekstremdata:', err);
    return null;
  }
}
