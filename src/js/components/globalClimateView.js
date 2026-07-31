/* ==========================================================================
   VÆR OG KLIMA I NORGE - GLOBAL CLIMATE VIEW COMPONENT
   ========================================================================== */

import { Chart, registerables } from 'chart.js';
import { getGlobalDataForRegion, GLOBAL_DATASETS, fetchNoaaSeaLevelData, fetchNoaaCo2Data } from '../api/globalClimateApi.js';

Chart.register(...registerables);

let globalChartInstance = null;
let currentGlobalRegion = 'global';
let activeVariable = 'temp'; // 'temp' | 'co2' | 'sealevel' | 'ice'
let activeGlobalRecordCategory = 'warmestYears'; // 'warmestYears' | 'fastestWarming' | 'co2Peaks' | 'highestSeaLevel'
let currentGlobalData = null;

export async function initGlobalClimateView() {
  const datasetSelect = document.getElementById('global-dataset-select');
  if (datasetSelect) {
    datasetSelect.addEventListener('change', (e) => {
      currentGlobalRegion = e.target.value;
      updateGlobalDashboard();
    });
  }

  // Variabel-velgere (Temperatur, CO2, Havnivå, Sjøis)
  const varBtns = document.querySelectorAll('.global-var-btn');
  varBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      varBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeVariable = btn.dataset.variable;
      if (currentGlobalData) {
        renderGlobalChart(currentGlobalData);
      }
    });
  });

  // Rekord-kategoriknapper
  const recordBtns = document.querySelectorAll('.global-record-pill');
  recordBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      recordBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeGlobalRecordCategory = btn.dataset.recordCategory;
      if (currentGlobalData) {
        renderGlobalRecordsGrid(currentGlobalData);
      }
    });
  });

  // Fetch live NOAA tide gauge data in the background; refresh when ready
  fetchNoaaSeaLevelData().then(() => {
    if (currentGlobalData) {
      currentGlobalData = getGlobalDataForRegion(currentGlobalRegion);
      if (activeVariable === 'sealevel') renderGlobalChart(currentGlobalData);
      updateGlobalKPIs(currentGlobalData);
    }
  }).catch(() => {});

  // Fetch live NOAA GML CO2 data (Mauna Loa) in the background; refresh when ready
  fetchNoaaCo2Data().then(() => {
    if (currentGlobalData) {
      currentGlobalData = getGlobalDataForRegion(currentGlobalRegion);
      if (activeVariable === 'co2') renderGlobalChart(currentGlobalData);
      updateGlobalKPIs(currentGlobalData);
    }
  }).catch(() => {});

  await updateGlobalDashboard();
}

export async function updateGlobalDashboard() {
  currentGlobalData = getGlobalDataForRegion(currentGlobalRegion);
  updateGlobalKPIs(currentGlobalData);
  renderGlobalChart(currentGlobalData);
  renderGlobalRecordsGrid(currentGlobalData);
}

function updateGlobalKPIs(data) {
  const tempEl = document.getElementById('g-kpi-temp');
  const co2El = document.getElementById('g-kpi-co2');
  const seaEl = document.getElementById('g-kpi-sea');
  const iceEl = document.getElementById('g-kpi-ice');

  if (tempEl) tempEl.textContent = `${data.kpis.globalTempAnomaly > 0 ? '+' : ''}${data.kpis.globalTempAnomaly} °C`;
  if (co2El) co2El.textContent = `${data.kpis.currentCo2Ppm} ppm`;
  if (seaEl) {
    // Find most recent year with real NOAA sea level data
    const seaVal = data.kpis.seaLevelMm ?? data.series.filter(s => s.seaLevelMm !== null && s.seaLevelMm !== undefined).slice(-1)[0]?.seaLevelMm;
    seaEl.textContent = seaVal != null ? `+${seaVal} mm` : '–';
  }
  if (iceEl) iceEl.textContent = `${data.kpis.arcticIceArea} mill. km²`;
}

function renderGlobalChart(data) {
  const canvas = document.getElementById('global-climate-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (globalChartInstance) {
    globalChartInstance.destroy();
  }

  const series = data ? (data.series || []) : [];
  let displaySeries = series;
  if (activeVariable === 'ice') {
    displaySeries = series.filter(s => s.year >= 1979);
  }

  const years = displaySeries.map(s => s.year);

  let datasetConfig = [];
  let yAxisLeftTitle = '';
  let yAxisLeftColor = '#00d2ff';
  let yAxisRightTitle = '';
  let yAxisRightColor = '#f59e0b';
  let hasDualAxis = false;

  if (activeVariable === 'temp') {
    const anomalies = displaySeries.map(s => s.anomaly);
    const trends = displaySeries.map(s => s.trend);

    datasetConfig = [
      {
        type: 'bar',
        label: 'Årlig Temperaturavvik (°C)',
        data: anomalies,
        backgroundColor: anomalies.map(v => v >= 0 ? 'rgba(244, 63, 94, 0.75)' : 'rgba(59, 130, 246, 0.75)'),
        borderColor: anomalies.map(v => v >= 0 ? '#f43f5e' : '#3b82f6'),
        borderWidth: 1,
        borderRadius: 2
      },
      {
        type: 'line',
        label: '10-års Klimatrend (°C)',
        data: trends,
        borderColor: '#f59e0b',
        borderWidth: 3,
        pointRadius: 0,
        tension: 0.35
      }
    ];
    yAxisLeftTitle = 'Temperaturavvik fra baseline (°C)';
  } else if (activeVariable === 'co2') {
    const co2Data = displaySeries.map(s => s.co2Ppm);
    datasetConfig = [
      {
        type: 'line',
        label: 'Atmosfærisk CO₂ (ppm) – NOAA GML / Mauna Loa',
        data: co2Data,
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        borderWidth: 3,
        fill: true,
        pointRadius: 1,
        tension: 0.3
      }
    ];
    yAxisLeftTitle = 'CO₂-konsentrasjon (ppm)';
    yAxisLeftColor = '#a855f7';
  } else if (activeVariable === 'sealevel') {
    // Filter out years where NOAA has no data (null)
    const seaFiltered = displaySeries.filter(s => s.seaLevelMm !== null && s.seaLevelMm !== undefined);
    const seaYears = seaFiltered.map(s => s.year);
    const seaData = seaFiltered.map(s => s.seaLevelMm);
    const years_ = seaYears; // override x-axis
    datasetConfig = [
      {
        type: 'line',
        label: 'Global Havnivåstigning (mm) – NOAA CO-OPS',
        data: seaData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderWidth: 3,
        fill: true,
        pointRadius: 1,
        tension: 0.3
      }
    ];
    yAxisLeftTitle = 'Havnivåstigning (mm rel. ~1880)';
    yAxisLeftColor = '#3b82f6';

    // Build chart with filtered years instead of full series years
    const minVal2 = Math.min(...seaData);
    const maxVal2 = Math.max(...seaData);
    const pad2 = Math.max(1, (maxVal2 - minVal2) * 0.05);
    globalChartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels: seaYears, datasets: datasetConfig },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, usePointStyle: true } },
          tooltip: {
            backgroundColor: '#131b2e', titleColor: '#f0f4fc',
            bodyColor: '#94a3b8', borderColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1, padding: 10,
            callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} mm` }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
          y: {
            position: 'left', beginAtZero: false,
            min: Math.floor(minVal2 - pad2), max: Math.ceil(maxVal2 + pad2),
            title: { display: true, text: yAxisLeftTitle, color: yAxisLeftColor, font: { family: 'Inter', size: 12, weight: '600' } },
            grid: { color: 'rgba(255,255,255,0.08)' },
            ticks: { color: yAxisLeftColor, font: { family: 'Inter', size: 11, weight: '600' }, callback: val => `${val} mm` }
          }
        }
      }
    });
    return; // already rendered above
  } else if (activeVariable === 'ice') {
    const iceData = displaySeries.map(s => s.arcticIceArea);
    datasetConfig = [
      {
        type: 'line',
        label: 'Arktisk Sjøis Minimum (mill. km²)',
        data: iceData,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        borderWidth: 3,
        fill: true,
        pointRadius: 2,
        tension: 0.2
      }
    ];
    yAxisLeftTitle = 'Isutbredelse (mill. km²)';
    yAxisLeftColor = '#38bdf8';
  }

  const minVal = Math.min(...(datasetConfig[0]?.data || [0]));
  const maxVal = Math.max(...(datasetConfig[0]?.data || [1]));
  const pad = Math.max(0.1, (maxVal - minVal) * 0.05);

  const scalesConfig = {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.05)' },
      ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
    },
    y: {
      position: 'left',
      beginAtZero: false,
      min: Number((minVal - pad).toFixed(2)),
      max: Number((maxVal + pad).toFixed(2)),
      title: {
        display: true,
        text: yAxisLeftTitle,
        color: yAxisLeftColor,
        font: { family: 'Inter', size: 12, weight: '600' }
      },
      grid: { color: 'rgba(255, 255, 255, 0.08)' },
      ticks: {
        color: yAxisLeftColor,
        font: { family: 'Inter', size: 11, weight: '600' },
        callback: val => Number(val.toFixed(2))
      }
    }
  };

  globalChartInstance = new Chart(ctx, {
    type: activeVariable === 'temp' ? 'bar' : 'line',
    data: {
      labels: years,
      datasets: datasetConfig
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
          padding: 10
        }
      },
      scales: scalesConfig
    }
  });
}

function renderGlobalRecordsGrid(data) {
  const container = document.getElementById('global-records-grid');
  const titleEl = document.getElementById('global-records-title');
  if (!container || !data || !data.records) return;

  if (titleEl) {
    titleEl.textContent = `🌐 Globale Rekorder & Observasjonsdata – ${data.regionName}`;
  }

  const cat = activeGlobalRecordCategory;

  if (cat === 'warmestYears' || cat === 'coldestYears') {
    const list = cat === 'warmestYears' ? (data.records.warmestYears || []) : (data.records.coldestYears || []);
    const metricClass = cat === 'warmestYears' ? 'warm' : 'cold';
    container.innerHTML = list.map((item, idx) => `
      <div class="extreme-item-card">
        <span class="extreme-rank rank-${idx + 1}">#${idx + 1}</span>
        <div class="extreme-info">
          <div class="extreme-place">År ${item.year}</div>
        </div>
        <div class="extreme-metric ${metricClass}">${item.anomaly > 0 ? '+' : ''}${item.anomaly} °C</div>
      </div>
    `).join('');
    return;
  }

  if (cat === 'elNino' || cat === 'laNina') {
    const list = cat === 'elNino' ? (data.records.elNinoEvents || []) : (data.records.laNinaEvents || []);
    const metricClass = cat === 'elNino' ? 'warm' : 'cold';
    container.innerHTML = list.map((item, idx) => `
      <div class="extreme-item-card">
        <span class="extreme-rank rank-${idx + 1}">#${idx + 1}</span>
        <div class="extreme-info">
          <div class="extreme-place">${item.year}</div>
          <div class="extreme-region">${item.name}</div>
        </div>
        <div class="extreme-metric ${metricClass}">${item.rate}</div>
      </div>
    `).join('');
    return;
  }
}
