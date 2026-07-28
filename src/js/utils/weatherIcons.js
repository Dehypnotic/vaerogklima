/* ==========================================================================
   VÆR OG KLIMA I NORGE - WEATHER ICONS & FORMATTERS
   ========================================================================== */

const WMO_MAP = {
  0: { text: 'Klarvær', icon: '☀️', bg: 'clear' },
  1: { text: 'Nesten klarvær', icon: '🌤️', bg: 'clear' },
  2: { text: 'Delvis skyet', icon: '⛅', bg: 'cloudy' },
  3: { text: 'Skyet', icon: '☁️', bg: 'cloudy' },
  45: { text: 'Tåke', icon: '🌫️', bg: 'fog' },
  48: { text: 'Rim-tåke', icon: '🌫️', bg: 'fog' },
  51: { text: 'Lett yr', icon: '🌦️', bg: 'rain' },
  53: { text: 'Moderat yr', icon: '🌧️', bg: 'rain' },
  55: { text: 'Tett yr', icon: '🌧️', bg: 'rain' },
  56: { text: 'Lett underkjølt yr', icon: '🌧️❄️', bg: 'rain' },
  57: { text: 'Tett underkjølt yr', icon: '🌧️❄️', bg: 'rain' },
  61: { text: 'Lett regn', icon: '🌦️', bg: 'rain' },
  63: { text: 'Moderat regn', icon: '🌧️', bg: 'rain' },
  65: { text: 'Kraftig regn', icon: '🌧️🌧️', bg: 'rain' },
  66: { text: 'Underkjølt regn', icon: '🌧️❄️', bg: 'rain' },
  67: { text: 'Kraftig underkjølt regn', icon: '🌧️❄️', bg: 'rain' },
  71: { text: 'Lett snøfall', icon: '🌨️', bg: 'snow' },
  73: { text: 'Moderat snøfall', icon: '❄️', bg: 'snow' },
  75: { text: 'Kraftig snøfall', icon: '❄️❄️', bg: 'snow' },
  77: { text: 'Snøkorn / hagl', icon: '🌨️', bg: 'snow' },
  80: { text: 'Lette regnbyger', icon: '🌦️', bg: 'rain' },
  81: { text: 'Moderat regnbyger', icon: '🌧️', bg: 'rain' },
  82: { text: 'Kraftige regnbyger', icon: '🌧️⚡', bg: 'rain' },
  85: { text: 'Lette snøbyger', icon: '🌨️', bg: 'snow' },
  86: { text: 'Kraftige snøbyger', icon: '❄️❄️', bg: 'snow' },
  95: { text: 'Tordenbyger', icon: '⛈️', bg: 'thunder' },
  96: { text: 'Tordenbyger med hagl', icon: '⛈️❄️', bg: 'thunder' },
  99: { text: 'Kraftige tordenbyger', icon: '⛈️⚡', bg: 'thunder' }
};

export function getWeatherInfo(code) {
  return WMO_MAP[code] || { text: 'Skyet', icon: '☁️', bg: 'cloudy' };
}

export function formatWindDirection(deg) {
  if (deg === undefined || deg === null) return '';
  const directions = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
  const index = Math.round(deg / 45) % 8;
  return directions[index];
}

export function formatTemp(temp) {
  if (temp === undefined || temp === null) return '--°';
  const round = Math.round(temp);
  return `${round > 0 ? '+' : ''}${round}°`;
}

export function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  const days = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
  return `${days[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`;
}
