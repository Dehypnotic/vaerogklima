/* ==========================================================================
   VÆR OG KLIMA I NORGE - 10 CITY CARDS COMPONENT
   ========================================================================== */

import { fetchCurrentAndForecast } from '../api/weatherApi.js';
import { getWeatherInfo, formatTemp, formatWindDirection } from '../utils/weatherIcons.js';
import { getSavedCities, saveCities, getHomeLocation, setHomeLocation, DEFAULT_CITIES } from '../utils/storage.js';

let activeCities = [];
let activeSelectedIndex = 0;
let onSelectCityCallback = null;
let onDoubleClickCityCallback = null;

export function initCityCards(onSelectCity, onDoubleClickCity) {
  onSelectCityCallback = onSelectCity;
  onDoubleClickCityCallback = onDoubleClickCity;

  activeCities = getSavedCities();

  const resetBtn = document.getElementById('btn-reset-cities');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeCities = [...DEFAULT_CITIES];
      saveCities(activeCities);
      renderAllCards();
      // Velg første by som aktiv
      selectCard(0);
    });
  }

  renderAllCards();

  // Sjekk om det finnes et lagret hjemsted og aktiver det som valgt hvis mulig
  const homeLoc = getHomeLocation();
  if (homeLoc) {
    const homeIndex = activeCities.findIndex(c => c.name === homeLoc.name);
    if (homeIndex !== -1) {
      selectCard(homeIndex);
    } else {
      // Hvis hjemstedet er et annet sted i Norge som ble satt som hjem
      if (onSelectCityCallback) {
        onSelectCityCallback(homeLoc, true);
      }
    }
  } else {
    selectCard(0);
  }
}

export function updateCityCard(index, newLocation) {
  if (index >= 0 && index < activeCities.length) {
    activeCities[index] = { ...newLocation };
    saveCities(activeCities);
    renderCardContent(index);
    selectCard(index);
  }
}

export function getActiveCities() {
  return activeCities;
}

export function getCurrentSelectedCity() {
  return activeCities[activeSelectedIndex];
}

function selectCard(index) {
  activeSelectedIndex = index;
  const cards = document.querySelectorAll('.city-box');
  cards.forEach((card, idx) => {
    if (idx === index) {
      card.classList.add('selected-active');
    } else {
      card.classList.remove('selected-active');
    }
  });

  const city = activeCities[index];
  if (city && onSelectCityCallback) {
    onSelectCityCallback(city);
  }
}

export function renderAllCards() {
  const container = document.getElementById('cities-grid');
  if (!container) return;

  container.innerHTML = activeCities.map((city, idx) => `
    <div class="city-box" id="city-box-${idx}" data-index="${idx}">
      <!-- Kort-innhold fylles dynamisk av renderCardContent -->
      <div class="loading-skeleton">Laster vær for ${city.name}...</div>
    </div>
  `).join('');

  // Bind hendelser på hvert kort
  activeCities.forEach((city, idx) => {
    const card = document.getElementById(`city-box-${idx}`);
    if (!card) return;

    // Enkeltklikk -> velg by for grafen
    card.addEventListener('click', (e) => {
      // Forhindre hvis det klikkes på en hjerte/hjem-knapp
      if (e.target.closest('.btn-card-home')) return;
      selectCard(idx);
    });

    // Dobbeltklikk -> åpne steds-søk for å bytte ut denne boksen
    card.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (onDoubleClickCityCallback) {
        onDoubleClickCityCallback(idx, activeCities[idx]);
      }
    });

    // Fetch sanntidsvær for by-kortet
    loadCityWeatherData(idx);
  });

  updateHomeBadges();
}

async function loadCityWeatherData(index) {
  const city = activeCities[index];
  if (!city) return;

  const card = document.getElementById(`city-box-${index}`);
  if (!card) return;

  try {
    const data = await fetchCurrentAndForecast(city.lat, city.lon);
    const current = data.current || {};
    const weather = getWeatherInfo(current.weather_code);

    const home = getHomeLocation();
    const isHome = home && home.name === city.name;

    card.innerHTML = `
      <div class="city-box-header">
        <div class="city-name-container">
          <span class="city-name">${city.name}</span>
          <span class="city-subtext">${city.region || 'Norge'}</span>
          <span class="double-click-hint">🖱️ Dobbeltklikk for å bytte sted</span>
        </div>
        <div class="city-weather-icon">${weather.icon}</div>
      </div>

      <div class="city-box-body">
        <div class="city-temp ${current.temperature_2m > 0 ? 'temp-warm' : 'temp-cold'}">${formatTemp(current.temperature_2m)}</div>
        <div class="city-condition">${weather.text}</div>
      </div>

      <div class="city-box-footer">
        <span class="city-stat-item">💧 ${current.relative_humidity_2m ?? '--'}%</span>
        <span class="city-stat-item">💨 ${Math.round(current.wind_speed_10m ?? 0)} m/s ${formatWindDirection(current.wind_direction_10m)}</span>
        <span class="city-stat-item">🌧️ ${current.precipitation ?? 0} mm</span>
      </div>
    `;

    if (isHome) {
      card.classList.add('is-home');
    } else {
      card.classList.remove('is-home');
    }

    if (index === activeSelectedIndex) {
      card.classList.add('selected-active');
    }
  } catch (err) {
    console.error(`Feil ved lasting av bykort #${index} (${city.name}):`, err);
    card.innerHTML = `
      <div class="city-box-header">
        <span class="city-name">${city.name}</span>
      </div>
      <div class="city-box-body">
        <div class="city-temp">--°</div>
        <div class="city-condition">Kunne ikke hente vær</div>
      </div>
    `;
  }
}

function renderCardContent(index) {
  loadCityWeatherData(index);
}

export function updateHomeBadges() {
  const home = getHomeLocation();
  activeCities.forEach((city, idx) => {
    const card = document.getElementById(`city-box-${idx}`);
    if (!card) return;

    if (home && home.name === city.name) {
      card.classList.add('is-home');
    } else {
      card.classList.remove('is-home');
    }
  });
}
