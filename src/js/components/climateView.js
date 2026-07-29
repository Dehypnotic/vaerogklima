/* ==========================================================================
   VÆR OG KLIMA I NORGE - CLIMATE TAB VIEW COMPONENT
   ========================================================================== */

import { Chart, registerables } from 'chart.js';
import { getClimateDataForRegion, CLIMATE_REGIONS } from '../api/climateApi.js';

Chart.register(...registerables);

let anomalyChartInstance = null;
let normalsChartInstance = null;
let currentRegion = 'all';
let currentStation = 'norway';
let currentSeason = 'annual';
let activeClimateCategory = 'warmest';
let currentClimateData = null;

export async function initClimateView() {
  const regionSelect = document.getElementById('climate-region-select');
  const stationSelect = document.getElementById('climate-station-select');

  function populateStations(regionKey) {
    if (!stationSelect) return;
    const regConfig = CLIMATE_REGIONS[regionKey] || CLIMATE_REGIONS.all;
    const stations = regConfig.stations || {};
    
    stationSelect.innerHTML = Object.keys(stations).map(stKey => {
      const st = stations[stKey];
      return `<option value="${stKey}">${st.name}</option>`;
    }).join('');

    const firstKey = Object.keys(stations)[0] || 'norway';
    currentStation = firstKey;
    stationSelect.value = firstKey;
  }

  if (regionSelect) {
    regionSelect.addEventListener('change', (e) => {
      currentRegion = e.target.value;
      populateStations(currentRegion);
      updateClimateDashboard();
    });
  }

  if (stationSelect) {
    stationSelect.addEventListener('change', (e) => {
      currentStation = e.target.value;
      updateClimateDashboard();
    });
  }

  const seasonSelect = document.getElementById('climate-season-select');
  if (seasonSelect) {
    seasonSelect.addEventListener('change', (e) => {
      currentSeason = e.target.value;
      updateClimateDashboard();
    });
  }

  const climatePills = document.querySelectorAll('.climate-pill');
  climatePills.forEach(btn => {
    btn.addEventListener('click', () => {
      climatePills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeClimateCategory = btn.dataset.climateCategory;
      if (currentClimateData) {
        renderClimateRecordsGrid(currentClimateData);
      }
    });
  });

  populateStations('all');
  await updateClimateDashboard();
}

export async function updateClimateDashboard() {
  currentClimateData = await getClimateDataForRegion(currentStation, currentSeason);
  updateKPICards(currentClimateData);
  renderAnomalyChart(currentClimateData);
  renderClimateRecordsGrid(currentClimateData);
  renderNormalsChart(currentClimateData);
}

function renderClimateRecordsGrid(data) {
  const container = document.getElementById('climate-records-grid');
  const titleEl = document.getElementById('climate-records-title');
  const subEl = document.getElementById('climate-records-subtitle');

  if (!container || !data || !data.records) return;

  if (titleEl) {
    titleEl.textContent = `🏆 Topp 10 Rekordår • ${data.seasonIcon} ${data.seasonName} (${data.regionName})`;
  }
  if (subEl) {
    subEl.textContent = `Historiske målinger (1950-2025) for ${data.regionName} i perioden ${data.seasonName}`;
  }

  const list = data.records[activeClimateCategory] || [];

  container.innerHTML = list.map((item, idx) => {
    let valueStr = '';
    let metricClass = '';

    if (activeClimateCategory === 'warmest') {
      valueStr = `${item.absTemp > 0 ? '+' : ''}${item.absTemp}°C`;
      metricClass = 'warm';
    } else if (activeClimateCategory === 'coldest') {
      valueStr = `${item.absTemp > 0 ? '+' : ''}${item.absTemp}°C`;
      metricClass = 'cold';
    } else if (activeClimateCategory === 'anomaly') {
      valueStr = `${item.anomaly > 0 ? '+' : ''}${item.anomaly}°C`;
      metricClass = 'warm';
    } else if (activeClimateCategory === 'wettest') {
      valueStr = `${item.precipMm} mm`;
      metricClass = 'rain';
    }

    return `
      <div class="extreme-item-card">
        <span class="extreme-rank rank-${idx + 1}">#${idx + 1}</span>
        <div class="extreme-info">
          <div class="extreme-place">År ${item.year}</div>
          <div class="extreme-region">Avvik: ${item.anomaly > 0 ? '+' : ''}${item.anomaly} °C fra normal</div>
        </div>
        <div class="extreme-metric ${metricClass}">${valueStr}</div>
      </div>
    `;
  }).join('');
}

function updateKPICards(data) {
  const tempIncEl = document.getElementById('kpi-temp-increase');
  const tempLabelEl = document.getElementById('kpi-temp-label');
  const tempDescEl = document.getElementById('kpi-temp-desc');
  const rainIncEl = document.getElementById('kpi-rain-increase');
  const warmestYearEl = document.getElementById('kpi-warmest-year');
  const recentYearValEl = document.getElementById('kpi-recent-year-val');
  const recentYearLabelEl = document.getElementById('kpi-recent-year-label');

  if (tempLabelEl) tempLabelEl.textContent = `10-års snitt (${data.regionName})`;
  if (tempIncEl) tempIncEl.textContent = `${data.summary.recentTrendIncrease > 0 ? '+' : ''}${data.summary.recentTrendIncrease} °C`;
  if (tempDescEl) tempDescEl.textContent = `Klimatrend fra 1961-1990 normal`;

  if (rainIncEl) rainIncEl.textContent = currentRegion === 'bergen' ? '+22 %' : '+18 %';
  if (warmestYearEl) warmestYearEl.textContent = '2020 / 2024';

  if (recentYearLabelEl) recentYearLabelEl.textContent = `Enkeltår 2025/26 (${data.regionName})`;
  if (recentYearValEl) recentYearValEl.textContent = `${data.summary.recentYearAnomaly > 0 ? '+' : ''}${data.summary.recentYearAnomaly} °C`;
}

function renderAnomalyChart(data) {
  const chartTitleEl = document.getElementById('climate-chart-title');
  if (chartTitleEl) {
    chartTitleEl.textContent = `Historisk Temperaturavvik (1950–Nå) • ${data.seasonIcon || ''} ${data.seasonName} (${data.regionName})`;
  }

  const canvas = document.getElementById('climate-trend-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (anomalyChartInstance) {
    anomalyChartInstance.destroy();
  }

  const series = data.series || [];
  const years = series.map(s => s.year);
  const anomalies = series.map(s => s.anomaly);
  const trends = series.map(s => s.trend);

  // Beregn dynamisk min og max for uavhengig 100% vertikal utnyttelse for alle områder
  const minAnomaly = Math.min(...anomalies);
  const maxAnomaly = Math.max(...anomalies);
  const anomalyPad = Math.max(0.3, (maxAnomaly - minAnomaly) * 0.05);

  const minTrend = Math.min(...trends);
  const maxTrend = Math.max(...trends);
  const trendPad = Math.max(0.3, (maxTrend - minTrend) * 0.05);

  // Generer røde og blå farger avhengig av anomali (+ eller -)
  const barColors = anomalies.map(val => val >= 0 ? 'rgba(244, 63, 94, 0.75)' : 'rgba(59, 130, 246, 0.75)');
  const borderColors = anomalies.map(val => val >= 0 ? '#f43f5e' : '#3b82f6');

  anomalyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        {
          type: 'line',
          label: '10-års Snittemperatur (°C)',
          data: trends,
          borderColor: '#f59e0b',
          borderWidth: 3,
          pointRadius: 0,
          tension: 0.4,
          fill: false,
          yAxisID: 'yTrend'
        },
        {
          type: 'bar',
          label: 'Temperaturavvik fra normal (°C)',
          data: anomalies,
          backgroundColor: barColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 2,
          yAxisID: 'yAnomaly'
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
            font: { family: 'Inter', size: 12 },
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: '#131b2e',
          titleColor: '#f0f4fc',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.yAxisID === 'yTrend') {
                return `${ctx.dataset.label}: ${ctx.raw} °C`;
              }
              return `${ctx.dataset.label}: ${ctx.raw > 0 ? '+' : ''}${ctx.raw} °C`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#94a3b8', maxTicksLimit: 15 }
        },
        yAnomaly: {
          type: 'linear',
          display: true,
          position: 'left',
          min: Math.floor((minAnomaly - anomalyPad) * 2) / 2,
          max: Math.ceil((maxAnomaly + anomalyPad) * 2) / 2,
          title: {
            display: true,
            text: 'Temperaturavvik (°C)',
            color: '#94a3b8',
            font: { family: 'Inter', size: 11, weight: '600' }
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: {
            color: '#94a3b8',
            callback: value => `${value > 0 ? '+' : ''}${value}°C`
          }
        },
        yTrend: {
          type: 'linear',
          display: true,
          position: 'right',
          min: Math.floor((minTrend - trendPad) * 2) / 2,
          max: Math.ceil((maxTrend + trendPad) * 2) / 2,
          title: {
            display: true,
            text: '10-års Snitt (°C)',
            color: '#f59e0b',
            font: { family: 'Inter', size: 11, weight: '600' }
          },
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#f59e0b',
            font: { family: 'Inter', size: 11, weight: '600' },
            callback: value => `${value}°C`
          }
        }
      }
    }
  });
}

function renderNormalsChart(data) {
  const canvas = document.getElementById('climate-normals-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (normalsChartInstance) {
    normalsChartInstance.destroy();
  }

  const normals = data.normals;

  normalsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: normals.months,
      datasets: [
        {
          label: 'Klimanormal 1961-1990',
          data: normals.n1961_1990,
          borderColor: '#3b82f6',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3
        },
        {
          label: 'Klimanormal 1991-2020',
          data: normals.n1991_2020,
          borderColor: '#00d2ff',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3
        },
        {
          label: 'Siste tiår (2011-2025)',
          data: normals.n2011_2025,
          borderColor: '#f43f5e',
          borderWidth: 3,
          pointRadius: 4,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
        },
        tooltip: {
          backgroundColor: '#131b2e',
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            callback: value => `${value}°C`
          }
        }
      }
    }
  });
}
