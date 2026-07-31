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

/**
 * Henter sanntidssmålinger for alle norske kommuner i kommuner_koordinater.json
 * direkte via Open-Meteo sin gratis multi-location batch API.
 * Beregner Topp 10 i 4 kategorier: varmest, kaldest, våtest og mest vind.
 */
export async function fetchExtremesData() {
  try {
    // Filtrer ut Arktis (Svalbard/Jan Mayen)
    const validKommuner = (Array.isArray(kommunerData) ? kommunerData : []).filter(k => {
      if (!k.kommune || k.lat === undefined || k.lon === undefined) return false;
      const name = k.kommune.toLowerCase();
      return !name.includes('svalbard') && !name.includes('jan mayen');
    });

    if (validKommuner.length === 0) return null;

    // Del kommunene inn i puljer på 90 om gangen for lynraske parallell-kall
    const BATCH_SIZE = 90;
    const batches = [];
    for (let i = 0; i < validKommuner.length; i += BATCH_SIZE) {
      batches.push(validKommuner.slice(i, i + BATCH_SIZE));
    }

    const batchPromises = batches.map(async (batch) => {
      const lats = batch.map(k => Number(k.lat).toFixed(4)).join(',');
      const lons = batch.map(k => Number(k.lon).toFixed(4)).join(',');

      const url = `${FORECAST_BASE_URL}?latitude=${lats}&longitude=${lons}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&daily=precipitation_sum&wind_speed_unit=ms&timezone=auto`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo feil: ${res.status}`);
      const rawList = await res.json();
      const list = Array.isArray(rawList) ? rawList : [rawList];

      return batch.map((k, idx) => {
        const itemData = list[idx] || {};
        const current = itemData.current || {};
        const daily = itemData.daily || {};

        const temp = typeof current.temperature_2m === 'number' ? current.temperature_2m : -999;
        const windSpeed = typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : 0;
        const rainToday = (daily.precipitation_sum && typeof daily.precipitation_sum[0] === 'number')
          ? daily.precipitation_sum[0]
          : (typeof current.precipitation === 'number' ? current.precipitation : 0);
        const code = current.weather_code || 0;

        return {
          name: k.kommune,
          navn: k.kommune,
          region: k.fylke || 'Kommune',
          fylke: k.fylke || '',
          lat: k.lat,
          lon: k.lon,
          temp,
          windSpeed,
          vind: windSpeed,
          rainToday,
          regn: rainToday,
          code
        };
      });
    });

    const resultsBatches = await Promise.all(batchPromises);
    const allProcessed = resultsBatches.flat().filter(k => k.temp !== -999);

    if (allProcessed.length === 0) return null;

    // Sorter topp 10 i 4 kategorier
    const warmest = [...allProcessed].sort((a, b) => b.temp - a.temp).slice(0, 10);
    const coldest = [...allProcessed].sort((a, b) => a.temp - b.temp).slice(0, 10);
    const wettest = [...allProcessed].sort((a, b) => b.rainToday - a.rainToday).slice(0, 10);
    const windiest = [...allProcessed].sort((a, b) => b.windSpeed - a.windSpeed).slice(0, 10);

    const now = new Date();
    const displayTime = now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });

    return {
      warmest,
      coldest,
      wettest,
      windiest,
      varmest: warmest,
      kaldest: coldest,
      vaatest: wettest,
      mest_vind: windiest,
      timestamp: displayTime
    };
  } catch (err) {
    console.error('Feil ved henting av kommunedata fra Open-Meteo:', err);
    return null;
  }
}
