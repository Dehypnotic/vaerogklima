/* ==========================================================================
   VÆR OG KLIMA I NORGE - LOCAL STORAGE UTILS
   ========================================================================== */

const STORAGE_KEYS = {
  HOME_LOCATION: 'vaer_klima_home_location',
  CITIES_LIST: 'vaer_klima_cities_list_v1'
};

export const DEFAULT_CITIES = [
  { id: 'oslo', name: 'Oslo', region: 'Østlandet', lat: 59.9139, lon: 10.7522 },
  { id: 'bergen', name: 'Bergen', region: 'Vestlandet', lat: 60.3930, lon: 5.3242 },
  { id: 'trondheim', name: 'Trondheim', region: 'Trøndelag', lat: 63.4305, lon: 10.3951 },
  { id: 'stavanger', name: 'Stavanger', region: 'Rogaland', lat: 58.9701, lon: 5.7333 },
  { id: 'drammen', name: 'Drammen', region: 'Buskerud', lat: 59.7439, lon: 10.2045 },
  { id: 'fredrikstad', name: 'Fredrikstad', region: 'Østfold', lat: 59.2181, lon: 10.9298 },
  { id: 'kristiansand', name: 'Kristiansand', region: 'Agder', lat: 58.1467, lon: 7.9956 },
  { id: 'tromso', name: 'Tromsø', region: 'Troms', lat: 69.6489, lon: 18.9551 },
  { id: 'sandnes', name: 'Sandnes', region: 'Rogaland', lat: 58.8524, lon: 5.7352 },
  { id: 'alesund', name: 'Ålesund', region: 'Møre og Romsdal', lat: 62.4723, lon: 6.1549 }
];

export function getSavedCities() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CITIES_LIST);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length === 10) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Kunne ikke lese lagrede byer fra localStorage', e);
  }
  return [...DEFAULT_CITIES];
}

export function saveCities(cities) {
  try {
    localStorage.setItem(STORAGE_KEYS.CITIES_LIST, JSON.stringify(cities));
  } catch (e) {
    console.error('Feil ved lagring av byer:', e);
  }
}

export function getHomeLocation() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HOME_LOCATION);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('Kunne ikke lese hjemsted fra localStorage', e);
  }
  return null;
}

export function setHomeLocation(location) {
  try {
    if (location) {
      localStorage.setItem(STORAGE_KEYS.HOME_LOCATION, JSON.stringify(location));
    } else {
      localStorage.removeItem(STORAGE_KEYS.HOME_LOCATION);
    }
  } catch (e) {
    console.error('Feil ved lagring av hjemsted:', e);
  }
}
