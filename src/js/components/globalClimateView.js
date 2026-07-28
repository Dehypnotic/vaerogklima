/* ==========================================================================
   VÆR OG KLIMA I NORGE - GLOBAL CLIMATE VIEW COMPONENT
   ========================================================================== */

import { Chart, registerables } from 'chart.js';
import { getGlobalDataForRegion, GLOBAL_REGIONS } from '../api/globalClimateApi.js';

Chart.register(...registerables);

let globalChartInstance = null;
let currentGlobalRegion = 'global';
let activeVariable = 'temp'; // 'temp' | 'co2' | 'sealevel' | 'ice'
let activeGlobalRecordCategory = 'warmestYears'; // 'warmestYears' | 'fastestWarming' | 'co2Peaks' | 'highestSeaLevel'
let currentGlobalData = null;

export async function initGlobalClimateView() {
  const regionSelect = document.getElementById('global-region-select');
  if (regionSelect) {
    regionSelect.addEventListener('change', (e) => {
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
  if (seaEl) seaEl.textContent = `+${data.kpis.seaLevelRiseMm} mm`;
  if (iceEl) iceEl.textContent = `${data.kpis.arcticIceMin} mill. km²`;
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
    // Start sjøis-grafen fra 1979 ved starten av kontinuerlige NSIDC satellittmålinger
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
    const trends = displaySeries.map(s => s.absTrend);
    const barColors = anomalies.map(val => val >= 0 ? 'rgba(244, 63, 94, 0.75)' : 'rgba(59, 130, 246, 0.75)');

    hasDualAxis = true;
    yAxisLeftTitle = 'Årlig Temperaturavvik (°C fra før-industrielt snitt)';
    yAxisLeftColor = '#94a3b8';
    yAxisRightTitle = '10-års Snittemperatur (°C)';
    yAxisRightColor = '#f59e0b';

    datasetConfig = [
      {
        type: 'line',
        label: '10-års Glidende Snittemperatur (°C)',
        data: trends,
        borderColor: '#f59e0b',
        borderWidth: 3,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: 'yRight'
      },
      {
        type: 'bar',
        label: 'Årlig Temperaturavvik (°C fra før-industrielt snitt)',
        data: anomalies,
        backgroundColor: barColors,
        borderWidth: 0,
        borderRadius: 2,
        yAxisID: 'yLeft'
      }
    ];
  } else if (activeVariable === 'co2') {
    const co2Vals = displaySeries.map(s => s.co2Ppm);
    const co2Grad = ctx.createLinearGradient(0, 0, 0, 300);
    co2Grad.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
    co2Grad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

    yAxisLeftTitle = 'Atmosfærisk CO₂-konsentrasjon (ppm)';
    yAxisLeftColor = '#a855f7';

    datasetConfig = [
      {
        type: 'line',
        label: 'CO₂ i Atmosfæren (Keeling-kurven i ppm)',
        data: co2Vals,
        borderColor: '#a855f7',
        backgroundColor: co2Grad,
        borderWidth: 3,
        fill: true,
        pointRadius: 1,
        tension: 0.3,
        yAxisID: 'yLeft'
      }
    ];
  } else if (activeVariable === 'sealevel') {
    const seaVals = displaySeries.map(s => s.seaLevelMm);
    const seaGrad = ctx.createLinearGradient(0, 0, 0, 300);
    seaGrad.addColorStop(0, 'rgba(0, 210, 255, 0.4)');
    seaGrad.addColorStop(1, 'rgba(0, 210, 255, 0.0)');

    yAxisLeftTitle = 'Global Havnivåstigning (mm siden 1880)';
    yAxisLeftColor = '#00d2ff';

    datasetConfig = [
      {
        type: 'line',
        label: 'Globalt Havnivå (mm)',
        data: seaVals,
        borderColor: '#00d2ff',
        backgroundColor: seaGrad,
        borderWidth: 3,
        fill: true,
        pointRadius: 1,
        tension: 0.3,
        yAxisID: 'yLeft'
      }
    ];
  } else if (activeVariable === 'ice') {
    const iceVals = displaySeries.map(s => s.arcticIceArea);

    yAxisLeftTitle = 'Arktisk Sjøis September-minimum (Mill. km² fra 1979)';
    yAxisLeftColor = '#3b82f6';

    datasetConfig = [
      {
        type: 'line',
        label: 'Arktisk Sjøisutbredelse (Mill. km² - NSIDC Satellitt-æra)',
        data: iceVals,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderWidth: 3,
        fill: true,
        pointRadius: 1.5,
        tension: 0.3,
        yAxisID: 'yLeft'
      }
    ];
  }

  // Beregn dynamisk min og max for full vertikal utnyttelse (100% aksestrekking)
  const primaryData = datasetConfig[datasetConfig.length - 1].data;
  const minVal = Math.min(...primaryData);
  const maxVal = Math.max(...primaryData);
  const pad = Math.max(0.1, (maxVal - minVal) * 0.08);

  let scalesConfig = {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.04)' },
      ticks: { color: '#94a3b8', maxTicksLimit: 15 }
    },
    yLeft: {
      type: 'linear',
      display: true,
      position: 'left',
      beginAtZero: false,
      min: Math.floor((minVal - pad) * 10) / 10,
      max: Math.ceil((maxVal + pad) * 10) / 10,
      title: {
        display: true,
        text: yAxisLeftTitle,
        color: yAxisLeftColor,
        font: { family: 'Inter', size: 11, weight: '600' }
      },
      grid: { color: 'rgba(255, 255, 255, 0.06)' },
      ticks: {
        color: yAxisLeftColor,
        callback: value => activeVariable === 'temp' ? `${value > 0 ? '+' : ''}${value}°C` : `${value}`
      }
    }
  };

  if (hasDualAxis) {
    const secondaryData = datasetConfig[0].data;
    const minSec = Math.min(...secondaryData);
    const maxSec = Math.max(...secondaryData);
    const padSec = Math.max(0.1, (maxSec - minSec) * 0.08);

    scalesConfig.yRight = {
      type: 'linear',
      display: true,
      position: 'right',
      beginAtZero: false,
      min: Math.floor((minSec - padSec) * 10) / 10,
      max: Math.ceil((maxSec + padSec) * 10) / 10,
      title: {
        display: true,
        text: yAxisRightTitle,
        color: yAxisRightColor,
        font: { family: 'Inter', size: 11, weight: '600' }
      },
      grid: { drawOnChartArea: false },
      ticks: {
        color: yAxisRightColor,
        font: { family: 'Inter', size: 11, weight: '600' },
        callback: value => `${Number(value).toFixed(1)}°C`
      }
    };
  }

  const chartType = activeVariable === 'temp' ? 'bar' : 'line';

  globalChartInstance = new Chart(ctx, {
    type: chartType,
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
    titleEl.textContent = `🌐 Globale Rekorder & Ekstremdata (${data.regionName})`;
  }

  const cat = activeGlobalRecordCategory;

  if (cat === 'fastestWarming') {
    const list = data.records.fastestWarmingRegions || [];
    container.innerHTML = list.map((item, idx) => `
      <div class="extreme-item-card">
        <span class="extreme-rank rank-${idx + 1}">#${idx + 1}</span>
        <div class="extreme-info">
          <div class="extreme-place">${item.name}</div>
          <div class="extreme-region">${item.factor}</div>
        </div>
        <div class="extreme-metric warm">${item.rate}</div>
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
        </div>
        <div class="extreme-metric ${metricClass}">${item.rate}</div>
      </div>
    `).join('');
    return;
  }

  let list = [];
  if (cat === 'warmestYears') list = data.records.warmestYears || [];

  container.innerHTML = list.map((item, idx) => `
    <div class="extreme-item-card">
      <span class="extreme-rank rank-${idx + 1}">#${idx + 1}</span>
      <div class="extreme-info">
        <div class="extreme-place">År ${item.year}</div>
      </div>
      <div class="extreme-metric warm">${item.anomaly > 0 ? '+' : ''}${item.anomaly} °C</div>
    </div>
  `).join('');
}
