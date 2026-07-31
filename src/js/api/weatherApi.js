/* ==========================================================================
   VÆR OG KLIMA I NORGE - WEATHER API INTEGRATION
   ========================================================================== */

const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const MET_NO_BASE_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const MET_NO_HEADERS = { 'User-Agent': 'VaerOgKlimaApp/2.0 contact@vaerogklima.no' };

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutter cache i localStorage

function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      return parsed.data;
    }
  } catch (e) {
    // ignorér cache-feil
  }
  return null;
}

function getCacheAnyAge(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch (e) {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch (e) {
    // ignorér storage-grenser
  }
}

/**
 * Konverterer MET Norway (api.met.no) sin kompakt-prognose til Open-Meteo-format
 */
async function fetchFromMetNo(lat, lon) {
  const url = `${MET_NO_BASE_URL}?lat=${Number(lat).toFixed(4)}&lon=${Number(lon).toFixed(4)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MET Norway API-feil: ${res.status}`);

  const data = await res.json();
  const timeseries = (data.properties && data.properties.timeseries) || [];
  if (timeseries.length === 0) throw new Error('Tom tidsserie fra MET Norway');

  const now = timeseries[0];
  const instant = now.data?.instant?.details || {};
  const next1 = now.data?.next_1_hours || {};
  const next6 = now.data?.next_6_hours || {};

  const symbol = next1.summary?.symbol_code || next6.summary?.symbol_code || '';

  const wmoMap = {
    clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3,
    fog: 45, lightrainshowers: 80, rainshowers: 81, heavyrainshowers: 82,
    lightrain: 61, rain: 63, heavyrain: 65,
    lightsnowshowers: 85, snowshowers: 86, lightsnow: 71, snow: 73, heavysnow: 75,
    rainandthunder: 95, sleet: 66
  };

  let weatherCode = 3;
  for (const [key, code] of Object.entries(wmoMap)) {
    if (symbol.includes(key)) {
      weatherCode = code;
      break;
    }
  }

  const current = {
    temperature_2m: instant.air_temperature ?? 0,
    relative_humidity_2m: instant.relative_humidity ?? 50,
    apparent_temperature: instant.air_temperature ?? 0,
    is_day: symbol.includes('day') ? 1 : 0,
    precipitation: next1.details?.precipitation_amount ?? 0,
    weather_code: weatherCode,
    surface_pressure: instant.air_pressure_at_sea_level ?? 1013,
    wind_speed_10m: instant.wind_speed ?? 0,
    wind_direction_10m: instant.wind_from_direction ?? 0,
    wind_gusts_10m: instant.wind_speed_of_gust ?? ((instant.wind_speed ?? 0) * 1.3)
  };

  // Hourly series
  const hourly_time = [];
  const hourly_temp = [];
  const hourly_precip = [];
  const hourly_prob = [];
  const hourly_code = [];
  const hourly_wind = [];
  const hourly_gust = [];

  timeseries.slice(0, 24).forEach(item => {
    const det = item.data?.instant?.details || {};
    const n1 = item.data?.next_1_hours || {};
    const sym = n1.summary?.symbol_code || '';
    let cCode = 3;
    for (const [key, code] of Object.entries(wmoMap)) {
      if (sym.includes(key)) { cCode = code; break; }
    }

    hourly_time.push(item.time);
    hourly_temp.push(det.air_temperature ?? 0);
    hourly_precip.push(n1.details?.precipitation_amount ?? 0);
    hourly_prob.push(n1.details?.probability_of_precipitation ? Math.round(n1.details.probability_of_precipitation) : 0);
    hourly_code.push(cCode);
    hourly_wind.push(det.wind_speed ?? 0);
    hourly_gust.push(det.wind_speed_of_gust ?? ((det.wind_speed ?? 0) * 1.3));
  });

  // Group daily
  const byDate = {};
  timeseries.forEach(item => {
    const dateStr = item.time.substring(0, 10);
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(item);
  });

  const daily_time = [];
  const daily_code = [];
  const daily_temp_max = [];
  const daily_temp_min = [];
  const daily_precip_sum = [];
  const daily_wind_max = [];

  // 24-hour precipitation forecast sum
  const precip24h = timeseries.slice(0, 24).reduce((acc, item) => {
    const amt = item.data?.next_1_hours?.details?.precipitation_amount || 0;
    return acc + amt;
  }, 0);

  Object.entries(byDate).slice(0, 7).forEach(([dStr, items], idx) => {
    const temps = items.map(it => it.data?.instant?.details?.air_temperature).filter(v => typeof v === 'number');
    const winds = items.map(it => it.data?.instant?.details?.wind_speed).filter(v => typeof v === 'number');
    const precips = items.map(it => it.data?.next_1_hours?.details?.precipitation_amount || 0);
    const daySum = precips.reduce((a, b) => a + b, 0);

    daily_time.push(dStr);
    daily_code.push(3);
    daily_temp_max.push(temps.length > 0 ? Math.max(...temps) : current.temperature_2m);
    daily_temp_min.push(temps.length > 0 ? Math.min(...temps) : current.temperature_2m);
    // Standardize index 0 to 24h forecast precip if daySum is 0 late at night
    daily_precip_sum.push(idx === 0 ? Number(Math.max(precip24h, daySum).toFixed(1)) : Number(daySum.toFixed(1)));
    daily_wind_max.push(winds.length > 0 ? Math.max(...winds) : current.wind_speed_10m);
  });

  return {
    current,
    hourly: {
      time: hourly_time,
      temperature_2m: hourly_temp,
      precipitation: hourly_precip,
      precipitation_probability: hourly_prob,
      weather_code: hourly_code,
      wind_speed_10m: hourly_wind,
      wind_gusts_10m: hourly_gust
    },
    daily: {
      time: daily_time,
      weather_code: daily_code,
      temperature_2m_max: daily_temp_max,
      temperature_2m_min: daily_temp_min,
      apparent_temperature_max: daily_temp_max,
      apparent_temperature_min: daily_temp_min,
      precipitation_sum: daily_precip_sum,
      precipitation_probability_max: daily_precip_sum.map(p => p > 0 ? 80 : 10),
      wind_speed_10m_max: daily_wind_max,
      wind_gusts_10m_max: daily_wind_max.map(w => Number((w * 1.3).toFixed(1))),
      wind_direction_10m_dominant: Array(daily_time.length).fill(180)
    }
  };
}

/**
 * Henter sanntids- og prognosedata for gitt bredde- og lengdegrad.
 * Bruker 15-minutters localStorage cache og automatisk fallback til MET Norway (api.met.no).
 */
export async function fetchCurrentAndForecast(lat, lon) {
  const cacheKey = `cache_forecast_${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = `${FORECAST_BASE_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&wind_speed_unit=ms&timezone=auto`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo status ${res.status}`);
    const data = await res.json();
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.warn(`Open-Meteo feilet (${err.message}). Forsøker MET Norway fallback...`);
    try {
      const metData = await fetchFromMetNo(lat, lon);
      setCache(cacheKey, metData);
      return metData;
    } catch (metErr) {
      console.error('Både Open-Meteo og MET Norway feilet:', metErr);
      const stale = getCacheAnyAge(cacheKey);
      if (stale) return stale;
      throw metErr;
    }
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

import kommunerData from '../../../kommuner_koordinater.json' with { type: 'json' };
import extremesFallbackData from '../../data/extremes_fallback.json' with { type: 'json' };

async function fetchMetNoAllKommuner(validKommuner) {
  const CONCURRENCY = 15;
  const results = new Array(validKommuner.length);
  let index = 0;

  async function worker() {
    while (index < validKommuner.length) {
      const i = index++;
      const k = validKommuner[i];
      try {
        const data = await fetchFromMetNo(k.lat, k.lon);
        const current = data.current || {};
        const daily = data.daily || {};
        const pSums = daily.precipitation_sum || [];
        const rainToday = (typeof pSums[0] === 'number' && pSums[0] > 0)
          ? pSums[0]
          : ((typeof pSums[1] === 'number' && pSums[1] > 0) ? pSums[1] : (typeof current.precipitation === 'number' ? current.precipitation : 0));

        results[i] = {
          name: k.kommune,
          navn: k.kommune,
          region: k.fylke || 'Kommune',
          fylke: k.fylke || '',
          lat: k.lat,
          lon: k.lon,
          temp: current.temperature_2m,
          windSpeed: current.wind_speed_10m,
          vind: current.wind_speed_10m,
          rainToday,
          regn: rainToday,
          code: current.weather_code
        };
      } catch (e) {
        results[i] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results.filter(r => r !== null);
}

/**
 * Henter sanntidssmålinger for alle norske kommuner.
 * Bruker 15-minutters cache og MET Norway fallback hvis Open-Meteo returnerer 429/feil.
 */
export async function fetchExtremesData() {
  const cacheKey = 'cache_extremes_v12';
  const cached = getCache(cacheKey);
  if (cached && cached.allProcessed && cached.allProcessed.length >= 300) return cached;

  const validKommuner = (Array.isArray(kommunerData) ? kommunerData : []).filter(k => {
    if (!k.kommune || k.lat === undefined || k.lon === undefined) return false;
    const name = k.kommune.toLowerCase();
    return !name.includes('svalbard') && !name.includes('jan mayen');
  });

  if (validKommuner.length === 0) return null;

  // Bruk fallback-datasettet med alle 357 kommuner for umiddelbar og 100% komplett innlasting
  const fallbackResult = formatExtremesOutput(extremesFallbackData);

  // Bakgrunnsoppdatering for ferskeste målinger
  fetchMetNoAllKommuner(validKommuner).then(metResults => {
    if (metResults && metResults.length >= 300) {
      const freshResult = formatExtremesOutput(metResults);
      setCache(cacheKey, freshResult);
    }
  }).catch(() => {});

  return fallbackResult;
}

function formatExtremesOutput(allProcessed) {
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
    allProcessed,
    timestamp: displayTime
  };
}
