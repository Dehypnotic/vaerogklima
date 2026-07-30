/* ==========================================================================
   VÆR OG KLIMA I NORGE - TOP 10 EXTREMES COMPONENT
   ========================================================================== */

import { fetchExtremesData } from '../api/weatherApi.js';
import { getWeatherInfo } from '../utils/weatherIcons.js';

let currentExtremesData = null;
let activeCategory = 'warmest';
let onSelectLocationCallback = null;

export async function initExtremes(onSelectLocation) {
  onSelectLocationCallback = onSelectLocation;

  const container = document.getElementById('extremes-container');
  const timestampEl = document.getElementById('extremes-timestamp');
  const categoryBtns = document.querySelectorAll('.extremes-section .pill-btn');

  // Kategori-knappenes lyttere
  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      renderExtremesGrid();
    });
  });

  // Hent data
  try {
    currentExtremesData = await fetchExtremesData();
    if (currentExtremesData) {
      if (timestampEl) timestampEl.textContent = `Oppdatert kl. ${currentExtremesData.timestamp}`;
      renderExtremesGrid();
    } else {
      container.innerHTML = '<div class="loading-skeleton">Kunne ikke laste ekstremdata akkurat nå.</div>';
    }
  } catch (err) {
    console.error('Feil i initExtremes:', err);
    container.innerHTML = '<div class="loading-skeleton">Feil ved laste ekstremdata.</div>';
  }
}

function renderExtremesGrid() {
  const container = document.getElementById('extremes-container');
  if (!container || !currentExtremesData) return;

  const list = currentExtremesData[activeCategory] || [];

  if (list.length === 0) {
    container.innerHTML = '<div class="loading-skeleton">Ingen data for denne kategorien.</div>';
    return;
  }

  container.innerHTML = list.map((item, idx) => {
    const weather = getWeatherInfo(item.code);
    let valueStr = '';
    let metricClass = '';

    const tempVal = typeof item.temp === 'number' ? item.temp : 0;
    const rainVal = item.rainToday !== undefined ? item.rainToday : (item.regn !== undefined ? item.regn : 0);
    const windVal = item.windSpeed !== undefined ? item.windSpeed : (item.vind !== undefined ? item.vind : 0);

    if (activeCategory === 'warmest' || activeCategory === 'coldest') {
      valueStr = `${tempVal > 0 ? '+' : ''}${tempVal.toFixed(1)}°C`;
      metricClass = tempVal > 0 ? 'warm' : 'cold';
    } else if (activeCategory === 'wettest') {
      valueStr = `${rainVal.toFixed(1)} mm`;
      metricClass = 'rain';
    } else if (activeCategory === 'windiest') {
      valueStr = `${windVal.toFixed(1)} m/s`;
      metricClass = 'wind';
    }

    const placeName = item.name || item.navn || 'Ukjent';
    const regionStr = item.region && item.region !== 'Kommune' ? `${item.region} • ` : '';

    return `
      <div class="extreme-item-card" data-lat="${item.lat}" data-lon="${item.lon}" data-name="${placeName}" data-region="${item.region || 'Kommune'}">
        <span class="extreme-rank rank-${idx + 1}">#${idx + 1}</span>
        <div class="extreme-info">
          <div class="extreme-place">${placeName}</div>
          <div class="extreme-region">${regionStr}${weather.icon} ${weather.text}</div>
        </div>
        <div class="extreme-metric ${metricClass}">${valueStr}</div>
      </div>
    `;
  }).join('');

  // Legg til klikklyttere på ekstremkort for å vise prognosen for stedet
  container.querySelectorAll('.extreme-item-card').forEach(card => {
    card.addEventListener('click', () => {
      const lat = parseFloat(card.dataset.lat);
      const lon = parseFloat(card.dataset.lon);
      const name = card.dataset.name;
      const region = card.dataset.region;

      if (onSelectLocationCallback) {
        onSelectLocationCallback({ name, region, lat, lon });
      }
    });
  });
}
