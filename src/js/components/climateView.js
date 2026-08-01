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

function formatLocationText(rawName = '') {
  let text = rawName.replace(/^📍\s*/, '').trim();
  // Fjern alt i paranteser
  text = text.replace(/\s*\([^)]*\)/g, '').trim();
  
  // Gjør " - " om til parantes for stasjonssteder: "Drammen - Berskog" -> "Drammen (Berskog)"
  if (text.includes(' - ')) {
    const parts = text.split(' - ');
    text = `${parts[0]} (${parts[1]})`;
  }

  // Rydd opp overskriftsbeskrivelse for hele landsdeler/Norge
  if (text.includes('Hele Norge')) return 'hele Norge';
  if (text.includes('Hele Østlandet')) return 'hele Østlandet';
  if (text.includes('Hele Sørlandet')) return 'hele Sørlandet';
  if (text.includes('Hele Vestlandet')) return 'hele Vestlandet';
  if (text.includes('Hele Nordvestlandet')) return 'hele Nordvestlandet';
  if (text.includes('Hele Trøndelag')) return 'hele Trøndelag';
  if (text.includes('Hele Nord-Norge')) return 'hele Nord-Norge';
  if (text.includes('Hele Arktis')) return 'hele Arktis';

  return text;
}

function formatSeasonText(seasonKey = 'annual') {
  const map = {
    annual: 'hele året',
    winter: 'vinter',
    spring: 'vår',
    summer: 'sommer',
    autumn: 'høst'
  };
  return map[seasonKey] || 'hele året';
}

function renderClimateRecordsGrid(data) {
  const container = document.getElementById('climate-records-grid');
  const titleEl = document.getElementById('climate-records-title');
  const subEl = document.getElementById('climate-records-subtitle');

  if (!container || !data || !data.records) return;

  const locText = formatLocationText(data.regionName);
  const seasonText = formatSeasonText(currentSeason);

  if (titleEl) {
    titleEl.textContent = `🏆 Topp 10 rekordår – ${seasonText} i ${locText}`;
  }
  if (subEl) {
    subEl.textContent = `Historiske observasjoner fra 1900 til i dag for ${seasonText} i ${locText}`;
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
  const rainLabelEl = document.getElementById('kpi-rain-label');
  const rainDescEl = document.getElementById('kpi-rain-desc');

  const warmestYearEl = document.getElementById('kpi-warmest-year');
  const warmestLabelEl = document.getElementById('kpi-warmest-label');
  const warmestDescEl = document.getElementById('kpi-warmest-desc');

  const recentYearValEl = document.getElementById('kpi-recent-year-val');
  const recentYearLabelEl = document.getElementById('kpi-recent-year-label');
  const recentYearDescEl = document.getElementById('kpi-recent-year-desc');

  const locText = formatLocationText(data.regionName);
  const seasonText = formatSeasonText(currentSeason);

  if (tempLabelEl) tempLabelEl.textContent = `10-års snitt oppvarming`;
  if (tempIncEl) {
    const trendVal = data.summary.recentTrendIncrease;
    tempIncEl.textContent = `${trendVal > 0 ? '+' : ''}${trendVal} °C`;
  }
  if (tempDescEl) tempDescEl.textContent = `For ${locText} fra 1961–1990 normal`;

  // Dynamisk beregnet nedbørsendring basert på 10-års glidende klimatrend (1900-1909 vs 2016-2025)
  if (rainLabelEl) rainLabelEl.textContent = `Nedbørsendring`;
  if (rainIncEl && data.series && data.series.length >= 10) {
    const first10Avg = data.series.slice(0, 10).reduce((sum, item) => sum + item.precipMm, 0) / 10;
    const last10Avg = data.series.slice(-10).reduce((sum, item) => sum + item.precipMm, 0) / 10;
    const diffPct = Math.round(((last10Avg - first10Avg) / first10Avg) * 100);
    rainIncEl.textContent = `${diffPct > 0 ? '+' : ''}${diffPct} %`;
  }
  if (rainDescEl) rainDescEl.textContent = `Trendøkning (${seasonText}) fra 1900 til i dag`;

  // Dynamisk varmeste registrert år for denne stasjonen og årstiden
  if (warmestLabelEl) warmestLabelEl.textContent = `Varmeste registrert (${seasonText})`;
  if (warmestYearEl && data.records && data.records.warmest && data.records.warmest.length > 0) {
    const topWarmest = data.records.warmest[0];
    const secondWarmest = data.records.warmest[1];
    if (secondWarmest && Math.abs(topWarmest.absTemp - secondWarmest.absTemp) < 0.1) {
      warmestYearEl.textContent = `${topWarmest.year} / ${secondWarmest.year}`;
    } else {
      warmestYearEl.textContent = `${topWarmest.year} (${topWarmest.absTemp > 0 ? '+' : ''}${topWarmest.absTemp}°C)`;
    }
  }
  if (warmestDescEl) warmestDescEl.textContent = `Rekordår for ${locText}`;

  // Dynamisk nyeste enkeltår
  if (data.series && data.series.length > 0) {
    const lastItem = data.series[data.series.length - 1];
    if (recentYearLabelEl) recentYearLabelEl.textContent = `${lastItem.year}`;
    if (recentYearValEl) {
      recentYearValEl.textContent = `${lastItem.absTemp > 0 ? '+' : ''}${lastItem.absTemp} °C (${lastItem.anomaly > 0 ? '+' : ''}${lastItem.anomaly}°C)`;
    }

    const isNational = currentStation === 'norway' || currentRegion === 'all';
    let descText = '';

    if (isNational) {
      const nationalMap = {
        annual: 'Nasjonalt årssnitt for hele Norge',
        winter: 'Nasjonalt vintersnitt for hele Norge',
        spring: 'Nasjonalt vårsnitt for hele Norge',
        summer: 'Nasjonalt sommersnitt for hele Norge',
        autumn: 'Nasjonalt høstsnitt for hele Norge'
      };
      descText = nationalMap[currentSeason] || 'Nasjonalt snitt for hele Norge';
    } else {
      const seasonPrefix = {
        annual: 'Årssnitt',
        winter: 'Vintersnitt',
        spring: 'Vårsnitt',
        summer: 'Sommersnitt',
        autumn: 'Høstsnitt'
      }[currentSeason] || 'Snitt';
      descText = `${seasonPrefix} for ${locText}`;
    }

    if (recentYearDescEl) {
      recentYearDescEl.textContent = descText;
    }
  }
}

const STATION_PROVENANCE_INFO = {
  norway: '📡 Datakilde: MET Norway nasjonalt homogenisert klimagjennomsnitt (1900–2025)',
  oslo_blindern: '📡 Datakilder: 1937–2025: Oslo – Blindern (SN18700) | 1900–1936: Oslo – Observatoriet (SN18500)',
  lillehammer: '📡 Datakilder: 1982–2025: Lillehammer – Sæterengen (SN12550) | 1900–1981: Lillehammer I/II (SN12530)',
  drammen: '📡 Datakilder: 1965–2025: Drammen – Berskog (SN17150) | 1900–1964: Drammen (SN17100)',
  geilo: '📡 Datakilder: 1967–2025: Geilo – Geilostølen (SN23550) | 1900–1966: Geilo I (SN23500)',
  kristiansand: '📡 Datakilder: 1942–2025: Kristiansand – Kjevik (SN39040) | 1900–1941: Kristiansand (SN39000)',
  arendal: '📡 Datakilde: 1867–2025: Arendal – Torungen Fyr (SN36200)',
  lindesnes: '📡 Datakilde: 1867–2025: Lindesnes Fyr (SN41100)',
  bergen_florida: '📡 Datakilder: 1957–2025: Bergen – Florida (SN50540) | 1900–1956: Bergen – Fredriksberg (SN50500)',
  stavanger_sola: '📡 Datakilder: 1935–2025: Stavanger – Sola (SN44560) | 1900–1934: Stavanger (SN44500)',
  floro: '📡 Datakilder: 1971–2025: Florø Lufthavn (SN57710) | 1900–1970: Florø Furuhed (SN57000)',
  laerdal: '📡 Datakilder: 1963–2025: Lærdal – Tønjum (SN53150) | 1900–1962: Lærdal (SN53100)',
  ona: '📡 Datakilder: 1978–2025: Ona II Fyr (SN62480) | 1900–1977: Ona I Fyr (SN62470)',
  kristiansund: '📡 Datakilder: 1970–2025: Kristiansund Lufthavn – Kvernberget (SN64330) | 1900–1969: Kristiansund (SN64300)',
  molde: '📡 Datakilder: 1972–2025: Molde Lufthavn – Årø (SN62270) | 1900–1971: Molde I/II (SN64200)',
  alesund: '📡 Datakilder: 1957–2025: Ålesund – Vigra (SN60940) | 1900–1956: Ålesund (SN60900)',
  sunndalsora: '📡 Datakilder: 1955–2025: Sunndalsøra (SN63420) | 1900–1954: Sunndalsøra I (SN63400)',
  tafjord: '📡 Datakilde: 1925–2025: Tafjord (SN60500)',
  trondheim_voll: '📡 Datakilder: 1998–2025 & 1923–1965: Trondheim – Voll (SN68860) | 1966–1997: Trondheim – Tyholt (SN68865) | 1900–1922: Trondheim – Bispehaugen (SN68830)',
  roros: '📡 Datakilder: 1957–2025: Røros Lufthavn (SN10380) | 1900–1956: Røros I/II (SN10350)',
  steinkjer: '📡 Datakilder: 1954–2025: Steinkjer – Egge (SN70850) | 1900–1953: Steinkjer (SN70800)',
  namsos: '📡 Datakilder: 1968–2025: Namsos Lufthavn (SN75200) | 1900–1967: Namsos (SN75100)',
  tromso: '📡 Datakilder: 1920–2025: Tromsø – Langnes (SN90450) | 1900–1919: Tromsø Sem (SN90400)',
  bodo: '📡 Datakilder: 1943–2025: Bodø Lufthavn (SN82290) | 1900–1942: Bodø (SN82200)',
  svolvaer: '📡 Datakilder: 1972–2025: Svolvær Lufthavn (SN85450) | 1900–1971: Svolvær (SN85400)',
  karasjok: '📡 Datakilde: 1876–2025: Karasjok – Markannjarga (SN97250)',
  kautokeino: '📡 Datakilde: 1888–2025: Kautokeino (SN96450)',
  vardo: '📡 Datakilde: 1867–2025: Vardø Radio (SN98550)',
  svalbard_lufthavn: '📡 Datakilder: 1975–2025: Svalbard Lufthavn (SN99840) | 1911–1974: Isfjord Radio / Longyearbyen (SN99870)',
  ny_alesund: '📡 Datakilder: 1969–2025: Ny-Ålesund (SN99910) | 1911–1968: Isfjord Radio (SN99870)',
  jan_mayen: '📡 Datakilde: 1921–2025: Jan Mayen (SN99950)',
  bjornoya: '📡 Datakilde: 1920–2025: Bjørnøya (SN99710)'
};

function renderAnomalyChart(data) {
  const chartTitleEl = document.getElementById('climate-chart-title');
  if (chartTitleEl) {
    const locText = formatLocationText(data.regionName);
    const seasonText = formatSeasonText(currentSeason);
    chartTitleEl.textContent = `Historisk temperaturavvik – ${seasonText} i ${locText}`;
  }

  const sourceBannerEl = document.getElementById('climate-data-source-banner');
  if (sourceBannerEl) {
    const info = STATION_PROVENANCE_INFO[currentStation] || '📡 Datakilde: MET Norway Frost API (frost.met.no)';
    sourceBannerEl.textContent = info;
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
  const precipTrends = series.map((_, idx) => {
    const start = Math.max(0, idx - 4);
    const end = Math.min(series.length, idx + 5);
    const window = series.slice(start, end);
    const avg = window.reduce((sum, item) => sum + item.precipMm, 0) / window.length;
    return Math.round(avg);
  });

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
          type: 'line',
          label: '10-års Snittnedbør (mm)',
          data: precipTrends,
          borderColor: '#06b6d4',
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 0,
          tension: 0.4,
          fill: false,
          yAxisID: 'yPrecip'
        },
        {
          type: 'bar',
          label: 'Temperaturavvik fra 1961–1990 normal (°C)',
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
          display: false
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
              if (ctx.dataset.yAxisID === 'yPrecip') {
                return `${ctx.dataset.label}: ${ctx.raw} mm`;
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
            display: false
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
            display: false
          },
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#f59e0b',
            callback: value => `${value}°C`
          }
        },
        yPrecip: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: false
          },
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#06b6d4',
            callback: value => `${value} mm`
          }
        }
      }
    }
  });

  // Koble til den interaktive tegnforklaringen over diagrammet
  const legendContainer = document.getElementById('climate-interactive-legend');
  if (legendContainer) {
    legendContainer.querySelectorAll('.legend-item').forEach(btn => {
      const idx = parseInt(btn.dataset.dataset, 10);
      btn.onclick = () => {
        if (!anomalyChartInstance) return;
        const isVisible = anomalyChartInstance.isDatasetVisible(idx);
        const newVisible = !isVisible;
        anomalyChartInstance.setDatasetVisibility(idx, newVisible);

        // Skjul/vis tilhørende akse på siden når datasettet slås av/på
        if (idx === 0 && anomalyChartInstance.options.scales.yTrend) {
          anomalyChartInstance.options.scales.yTrend.display = newVisible;
        } else if (idx === 1 && anomalyChartInstance.options.scales.yPrecip) {
          anomalyChartInstance.options.scales.yPrecip.display = newVisible;
        } else if (idx === 2 && anomalyChartInstance.options.scales.yAnomaly) {
          anomalyChartInstance.options.scales.yAnomaly.display = newVisible;
        }

        anomalyChartInstance.update();
        btn.classList.toggle('hidden', !newVisible);
      };
      btn.classList.remove('hidden');
    });
  }
}

function renderNormalsChart(data) {
  const canvas = document.getElementById('climate-normals-chart');
  const titleEl = document.getElementById('climate-normals-title');
  const subEl = document.getElementById('climate-normals-subtitle');

  const locText = formatLocationText(data.regionName);

  if (titleEl) titleEl.textContent = `Klimanormaler sammenlignet – måned for måned`;
  if (subEl) subEl.textContent = `Månedlige normaltemperaturer for ${locText} (1961–1990 vs. 1991–2020 og 2011–2025)`;

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
