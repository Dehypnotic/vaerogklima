/* ==========================================================================
   VÆR OG KLIMA I NORGE - FORECAST CHART & DETAIL COMPONENT
   ========================================================================== */

import { Chart, registerables } from 'chart.js';
import { fetchCurrentAndForecast } from '../api/weatherApi.js';
import { getWeatherInfo, formatTemp, formatWindDirection, formatDateShort } from '../utils/weatherIcons.js';
import { getHomeLocation, setHomeLocation } from '../utils/storage.js';
import { updateHomeBadges } from './cityCards.js';

Chart.register(...registerables);

let chartInstance = null;
let currentLocation = null;
let currentForecastData = null;
let activeChartMode = 'hourly'; // 'hourly' | 'daily'

export async function initForecastSection() {
  const modeBtns = document.querySelectorAll('.chart-tab-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeChartMode = btn.dataset.mode;
      if (currentForecastData) {
        renderChart();
      }
    });
  });

  const setHomeBtn = document.getElementById('btn-set-home');
  if (setHomeBtn) {
    setHomeBtn.addEventListener('click', () => {
      if (!currentLocation) return;
      const currentHome = getHomeLocation();

      if (currentHome && currentHome.name === currentLocation.name) {
        // Fjern som hjem
        setHomeLocation(null);
        alert(`${currentLocation.name} er tilbakestilt som hjemsted.`);
      } else {
        // Sett som hjem
        setHomeLocation(currentLocation);
        alert(`${currentLocation.name} er nå valgt som ditt standard hjem-sted! 🏠`);
      }

      updateHomeTag();
      updateHomeBadges();
    });
  }
}

export async function loadForecastForLocation(location, isHomeSelection = false) {
  currentLocation = location;

  const titleEl = document.getElementById('forecast-location-name');
  const coordsEl = document.getElementById('forecast-location-coords');

  if (titleEl) titleEl.textContent = location.name;
  if (coordsEl) coordsEl.textContent = `${location.region || 'Norge'} (Lat ${location.lat.toFixed(2)}, Lon ${location.lon.toFixed(2)})`;

  updateHomeTag();

  try {
    currentForecastData = await fetchCurrentAndForecast(location.lat, location.lon);
    renderCurrentSnap();
    renderChart();
    renderDailyCards();
  } catch (err) {
    console.error('Feil ved uthenting av prognose for graf:', err);
  }
}

function updateHomeTag() {
  const homeTag = document.getElementById('forecast-home-tag');
  const setHomeBtn = document.getElementById('btn-set-home');
  const home = getHomeLocation();

  if (homeTag && setHomeBtn && currentLocation) {
    if (home && home.name === currentLocation.name) {
      homeTag.classList.remove('hidden');
      setHomeBtn.innerHTML = '✨ Fjern som Mitt Hjem';
      setHomeBtn.classList.remove('btn-primary');
      setHomeBtn.classList.add('btn-secondary');
    } else {
      homeTag.classList.add('hidden');
      setHomeBtn.innerHTML = '🏠 Sett som Mitt Hjem';
      setHomeBtn.classList.remove('btn-secondary');
      setHomeBtn.classList.add('btn-primary');
    }
  }
}

function renderCurrentSnap() {
  const snapContainer = document.getElementById('selected-current-snap');
  if (!snapContainer || !currentForecastData) return;

  const current = currentForecastData.current || {};
  const weather = getWeatherInfo(current.weather_code);

  snapContainer.innerHTML = `
    <div class="snap-temp-block">
      <div class="snap-icon">${weather.icon}</div>
      <div>
        <div class="snap-degrees">${formatTemp(current.temperature_2m)}</div>
        <div class="snap-feels">Føles som ${formatTemp(current.apparent_temperature)} • ${weather.text}</div>
      </div>
    </div>

    <div class="snap-details-grid">
      <div class="snap-metric">
        <span class="snap-metric-title">Vindstyrke</span>
        <span class="snap-metric-value">${Math.round(current.wind_speed_10m ?? 0)} m/s (${formatWindDirection(current.wind_direction_10m)})</span>
      </div>
      <div class="snap-metric">
        <span class="snap-metric-title">Vindkast</span>
        <span class="snap-metric-value">${Math.round(current.wind_gusts_10m ?? 0)} m/s</span>
      </div>
      <div class="snap-metric">
        <span class="snap-metric-title">Luftfuktighet</span>
        <span class="snap-metric-value">${current.relative_humidity_2m ?? '--'}%</span>
      </div>
      <div class="snap-metric">
        <span class="snap-metric-title">Lufttrykk</span>
        <span class="snap-metric-value">${Math.round(current.surface_pressure ?? 1013)} hPa</span>
      </div>
    </div>
  `;
}

function renderChart() {
  const canvas = document.getElementById('forecast-chart');
  if (!canvas || !currentForecastData) return;

  const ctx = canvas.getContext('2d');

  if (chartInstance) {
    chartInstance.destroy();
  }

  let labels = [];
  let tempData = [];
  let rainData = [];
  let windData = [];

  if (activeChartMode === 'hourly') {
    const hourly = currentForecastData.hourly || {};
    const rawTimes = hourly.time || [];
    // Vis neste 24 timer
    const sliceCount = 24;

    labels = rawTimes.slice(0, sliceCount).map(t => {
      const d = new Date(t);
      return `${String(d.getHours()).padStart(2, '0')}:00`;
    });

    tempData = (hourly.temperature_2m || []).slice(0, sliceCount);
    rainData = (hourly.precipitation || []).slice(0, sliceCount);
    windData = (hourly.wind_speed_10m || []).slice(0, sliceCount);
  } else {
    const daily = currentForecastData.daily || {};
    const rawTimes = daily.time || [];

    labels = rawTimes.map(t => formatDateShort(t));
    tempData = daily.temperature_2m_max || [];
    rainData = daily.precipitation_sum || [];
    windData = daily.wind_speed_10m_max || [];
  }

  // Opprett gradient for temperaturkurven
  const tempGradient = ctx.createLinearGradient(0, 0, 0, 300);
  tempGradient.addColorStop(0, 'rgba(0, 210, 255, 0.4)');
  tempGradient.addColorStop(1, 'rgba(0, 210, 255, 0.0)');

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Temperatur (°C)',
          data: tempData,
          borderColor: '#00d2ff',
          backgroundColor: tempGradient,
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#00d2ff',
          yAxisID: 'yTemp'
        },
        {
          type: 'bar',
          label: 'Nedbør (mm)',
          data: rainData,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'yRain'
        },
        {
          type: 'line',
          label: 'Vind (m/s)',
          data: windData,
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 2,
          fill: false,
          tension: 0.3,
          yAxisID: 'yWind'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 12, weight: '600' },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: '#131b2e',
          titleColor: '#f0f4fc',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 12,
          displayColors: true
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
        },
        yTemp: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#00d2ff',
            font: { family: 'Inter', size: 11 },
            callback: value => `${value}°`
          }
        },
        yRain: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#3b82f6',
            font: { family: 'Inter', size: 11 },
            callback: value => `${value}mm`
          },
          suggestedMax: 10
        },
        yWind: {
          type: 'linear',
          display: false,
          position: 'right',
          suggestedMax: 25
        }
      }
    }
  });
}

function renderDailyCards() {
  const container = document.getElementById('daily-cards');
  if (!container || !currentForecastData || !currentForecastData.daily) return;

  const daily = currentForecastData.daily;
  const times = daily.time || [];
  const maxTemps = daily.temperature_2m_max || [];
  const minTemps = daily.temperature_2m_min || [];
  const rainSums = daily.precipitation_sum || [];
  const codes = daily.weather_code || [];

  container.innerHTML = times.slice(0, 7).map((t, idx) => {
    const weather = getWeatherInfo(codes[idx]);
    return `
      <div class="daily-card">
        <div class="daily-day">${formatDateShort(t)}</div>
        <div class="daily-icon">${weather.icon}</div>
        <div class="daily-temps">
          <span class="daily-max">${formatTemp(maxTemps[idx])}</span>
          <span class="daily-min">${formatTemp(minTemps[idx])}</span>
        </div>
        <div class="daily-rain">${rainSums[idx] > 0 ? `🌧️ ${rainSums[idx]} mm` : '☀️ Opphold'}</div>
      </div>
    `;
  }).join('');
}
