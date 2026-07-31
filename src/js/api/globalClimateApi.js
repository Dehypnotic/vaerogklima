/* ==========================================================================
   VÆR OG KLIMA I NORGE - GLOBAL CLIMATE API & DATASETS (NOAA/NASA/WMO/IPCC)
   ========================================================================== */

// NOAA CO-OPS multi-station tide gauge composite (10 US long-running gauges)
// Sources: San Francisco (1880), The Battery NY (1893), Honolulu (1911),
//          Key West (1913), Charleston (1901), Seattle (1899),
//          Portland ME (1912), San Diego (1906), Galveston (1904)
// Rebaselined: 1880 ≈ 0 mm. Averaged across all stations reporting each year.
// Data fetched live at startup if possible; these values serve as a reliable fallback.
const NOAA_SEA_LEVEL_MM = {
  1893: -8, 1894: -6, 1895: 11, 1896: 21, 1897: 7, 1898: -26, 1899: 1,
  1900: 9, 1901: -6, 1902: 15, 1903: 10, 1904: -19, 1905: -20, 1906: -8, 1907: 5,
  1908: -18, 1909: 4, 1910: -22, 1911: -1, 1912: -2, 1913: 13, 1914: 48, 1915: 48,
  1916: 24, 1917: 6, 1918: 29, 1919: 50, 1920: 49, 1921: 61, 1922: 28, 1923: 32,
  1924: 12, 1925: 32, 1926: 23, 1927: 40, 1928: 18, 1929: 32, 1930: 38, 1931: 31,
  1932: 52, 1933: 59, 1934: 32, 1935: 65, 1936: 63, 1937: 76, 1938: 72, 1939: 60,
  1940: 85, 1941: 106, 1942: 98, 1943: 100, 1944: 101, 1945: 102, 1946: 116,
  1947: 118, 1948: 138, 1949: 115, 1950: 111, 1951: 124, 1952: 127, 1953: 128,
  1954: 119, 1955: 108, 1956: 111, 1957: 144, 1958: 165, 1959: 150, 1960: 140,
  1961: 147, 1962: 142, 1963: 129, 1964: 109, 1965: 141, 1966: 144, 1967: 150,
  1968: 151, 1969: 181, 1970: 159, 1971: 155, 1972: 198, 1973: 187, 1974: 185,
  1975: 181, 1976: 162, 1977: 171, 1978: 198, 1979: 184, 1980: 188, 1981: 188,
  1982: 204, 1983: 263, 1984: 224, 1985: 193, 1986: 211, 1987: 210, 1988: 185,
  1989: 182, 1990: 201, 1991: 230, 1992: 251, 1993: 241, 1994: 216, 1995: 256,
  1996: 229, 1997: 265, 1998: 256, 1999: 211, 2000: 204, 2001: 201, 2002: 208,
  2003: 224, 2004: 225, 2005: 251, 2006: 241, 2007: 216, 2008: 229, 2009: 248,
  2010: 270, 2011: 252, 2012: 270, 2013: 254, 2014: 288, 2015: 297, 2016: 307,
  2017: 314, 2018: 296, 2019: 333, 2020: 328, 2021: 315, 2022: 313, 2023: 360,
  2024: 344, 2025: 307
};

// NOAA CO-OPS stations used for live fetch (station IDs)
const NOAA_STATIONS = [
  { name: 'San Francisco', id: '9414290' },
  { name: 'The Battery',   id: '8518750' },
  { name: 'Honolulu',      id: '1612340' },
  { name: 'Key West',      id: '8724580' },
  { name: 'Charleston',    id: '8665530' },
  { name: 'Seattle',       id: '9447130' },
  { name: 'Portland ME',   id: '8418150' },
  { name: 'San Diego',     id: '9410170' },
  { name: 'Galveston',     id: '8771450' },
];

let _cachedSeaLevel = null;

async function fetchStationAnnual(stationId, beginYear, endYear) {
  const results = {};
  for (let startYr = beginYear; startYr <= endYear; startYr += 50) {
    const endYr = Math.min(startYr + 49, endYear);
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
      `?begin_date=${startYr}0101&end_date=${endYr}1231` +
      `&product=monthly_mean&datum=MSL&station=${stationId}` +
      `&time_zone=GMT&units=metric&format=json`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()).data || [];
      const byYear = {};
      data.forEach(row => {
        const msl = parseFloat(row.MSL);
        if (!isNaN(msl)) {
          if (!byYear[row.year]) byYear[row.year] = [];
          byYear[row.year].push(msl);
        }
      });
      Object.entries(byYear).forEach(([yr, vals]) => {
        results[parseInt(yr)] = vals.reduce((a, b) => a + b, 0) / vals.length;
      });
    } catch {}
  }
  return results;
}

export async function fetchNoaaSeaLevelData() {
  if (_cachedSeaLevel) return _cachedSeaLevel;

  try {
    const stationData = await Promise.all(
      NOAA_STATIONS.map(s => fetchStationAnnual(s.id, 1880, new Date().getFullYear()))
    );

    // Normalize each station to its 1920–1960 mean, then average years
    const allYears = {};
    stationData.forEach(annual => {
      const baselineVals = Object.entries(annual)
        .filter(([yr]) => parseInt(yr) >= 1920 && parseInt(yr) <= 1960)
        .map(([, v]) => v);
      if (baselineVals.length < 5) return;
      const baseline = baselineVals.reduce((a, b) => a + b, 0) / baselineVals.length;
      Object.entries(annual).forEach(([yr, v]) => {
        const y = parseInt(yr);
        if (!allYears[y]) allYears[y] = [];
        allYears[y].push(v - baseline);
      });
    });

    // Average across stations (require ≥2), rebaseline 1880–1900 → 0
    const combined = {};
    Object.entries(allYears).forEach(([yr, vals]) => {
      if (vals.length >= 2) combined[parseInt(yr)] = vals.reduce((a, b) => a + b, 0) / vals.length;
    });

    const earlyVals = Object.entries(combined)
      .filter(([yr]) => parseInt(yr) <= 1900)
      .map(([, v]) => v);
    const offset = earlyVals.length > 0 ? earlyVals.reduce((a, b) => a + b, 0) / earlyVals.length : 0;

    const result = {};
    Object.entries(combined).forEach(([yr, v]) => {
      result[parseInt(yr)] = Math.round((v - offset) * 1000);
    });

    _cachedSeaLevel = result;
    return result;
  } catch {
    return null;
  }
}

// ==========================================================================
// CO₂ DATA: Law Dome ice core (1880–1958) + NOAA GML Mauna Loa (1959–2025)
// Ice core: MacFarling Meure et al. 2006, Law Dome, Antarctica (NOAA NCEI)
// Direct: Keeling Curve / NOAA GML gml.noaa.gov/ccgg/trends/
// ==========================================================================
const NOAA_CO2_PPM = {
  // Law Dome ice core reconstruction (pre-Keeling):
  1880: 291.1, 1881: 291.3, 1882: 291.5, 1883: 291.8, 1884: 292.0,
  1885: 292.3, 1886: 292.6, 1887: 292.9, 1888: 293.2, 1889: 293.5,
  1890: 293.8, 1891: 294.1, 1892: 294.4, 1893: 294.7, 1894: 295.0,
  1895: 295.3, 1896: 295.7, 1897: 296.0, 1898: 296.3, 1899: 296.6,
  1900: 296.9, 1901: 297.3, 1902: 297.6, 1903: 297.9, 1904: 298.2,
  1905: 298.5, 1906: 298.9, 1907: 299.2, 1908: 299.5, 1909: 299.8,
  1910: 300.1, 1911: 300.5, 1912: 300.8, 1913: 301.1, 1914: 301.4,
  1915: 301.8, 1916: 302.1, 1917: 302.4, 1918: 302.7, 1919: 303.0,
  1920: 303.3, 1921: 303.6, 1922: 303.9, 1923: 304.2, 1924: 304.5,
  1925: 304.8, 1926: 305.1, 1927: 305.4, 1928: 305.7, 1929: 306.0,
  1930: 306.3, 1931: 306.6, 1932: 306.9, 1933: 307.2, 1934: 307.5,
  1935: 307.7, 1936: 308.0, 1937: 308.3, 1938: 308.6, 1939: 308.9,
  1940: 309.2, 1941: 309.4, 1942: 309.7, 1943: 310.0, 1944: 310.2,
  1945: 310.5, 1946: 310.7, 1947: 310.9, 1948: 311.1, 1949: 311.3,
  1950: 311.5, 1951: 311.7, 1952: 311.9, 1953: 312.1, 1954: 312.2,
  1955: 312.4, 1956: 312.7, 1957: 313.1, 1958: 315.0,
  // NOAA GML Mauna Loa Observatory (Keeling Curve — authoritative direct measurements):
  1959: 315.98, 1960: 316.91, 1961: 317.64, 1962: 318.45, 1963: 318.99,
  1964: 319.62, 1965: 320.04, 1966: 321.37, 1967: 322.18, 1968: 323.05,
  1969: 324.62, 1970: 325.68, 1971: 326.32, 1972: 327.46, 1973: 329.68,
  1974: 330.19, 1975: 331.13, 1976: 332.03, 1977: 333.84, 1978: 335.41,
  1979: 336.84, 1980: 338.76, 1981: 340.12, 1982: 341.48, 1983: 343.15,
  1984: 344.87, 1985: 346.35, 1986: 347.61, 1987: 349.31, 1988: 351.69,
  1989: 353.20, 1990: 354.45, 1991: 355.70, 1992: 356.54, 1993: 357.21,
  1994: 358.96, 1995: 360.97, 1996: 362.74, 1997: 363.88, 1998: 366.84,
  1999: 368.54, 2000: 369.71, 2001: 371.32, 2002: 373.45, 2003: 375.98,
  2004: 377.70, 2005: 379.98, 2006: 382.09, 2007: 384.02, 2008: 385.83,
  2009: 387.64, 2010: 390.10, 2011: 391.85, 2012: 394.06, 2013: 396.74,
  2014: 398.81, 2015: 401.01, 2016: 404.41, 2017: 406.76, 2018: 408.72,
  2019: 411.65, 2020: 414.21, 2021: 416.41, 2022: 418.53, 2023: 421.08,
  2024: 424.61, 2025: 427.35
};

let _cachedCo2 = null;

export async function fetchNoaaCo2Data() {
  if (_cachedCo2) return _cachedCo2;

  try {
    // NOAA GML annual mean CO2 – Mauna Loa Observatory
    const url = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.txt';
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();

    const mloData = {};
    text.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const yr = parseInt(parts[0]);
        const ppm = parseFloat(parts[1]);
        if (!isNaN(yr) && !isNaN(ppm)) mloData[yr] = ppm;
      }
    });

    if (Object.keys(mloData).length < 10) return null;

    // Merge: Law Dome pre-1959, Mauna Loa 1959+
    _cachedCo2 = { ...NOAA_CO2_PPM };
    Object.entries(mloData).forEach(([yr, ppm]) => {
      _cachedCo2[parseInt(yr)] = ppm;
    });

    return _cachedCo2;
  } catch {
    return null;
  }
}

// ==========================================================================
// ENSO DATA: NOAA CPC Oceanic Niño Index (ONI) / NINO3.4 SST Anomaly Index
// Source: NOAA Climate Prediction Center (cpc.ncep.noaa.gov/data/indices/oni.ascii.txt)
// Baseline: 3-month running mean Sea Surface Temperature anomaly in Niño 3.4
// Values ≥ +0.5 °C = El Niño, ≤ -0.5 °C = La Niña
// ==========================================================================
const NOAA_ENSO_ONI = {
  1950: -1.53, 1951: 1.15, 1952: 0.53, 1953: 0.84, 1954: -0.9,
  1955: -1.67, 1956: -1.11, 1957: 1.74, 1958: 1.81, 1959: 0.62,
  1960: 0.27, 1961: -0.3, 1962: -0.43, 1963: 1.37, 1964: 1.07,
  1965: 1.98, 1966: 1.37, 1967: -0.53, 1968: 0.98, 1969: 1.13,
  1970: -1.15, 1971: -1.38, 1972: 2.12, 1973: -2.03, 1974: -1.84,
  1975: -1.65, 1976: -1.56, 1977: 0.81, 1978: 0.69, 1979: 0.64,
  1980: 0.59, 1981: -0.5, 1982: 2.23, 1983: 2.18, 1984: -1.14,
  1985: -1.04, 1986: 1.22, 1987: 1.7, 1988: -1.85, 1989: -1.69,
  1990: 0.41, 1991: 1.53, 1992: 1.71, 1993: 0.7, 1994: 1.09,
  1995: -1.0, 1996: -0.9, 1997: 2.4, 1998: 2.24, 1999: -1.65,
  2000: -1.66, 2001: -0.68, 2002: 1.31, 2003: 0.92, 2004: 0.7,
  2005: -0.84, 2006: 0.94, 2007: -1.6, 2008: -1.64, 2009: 1.56,
  2010: -1.64, 2011: -1.31, 2012: -0.72, 2013: -0.35, 2014: 0.77,
  2015: 2.75, 2016: 2.63, 2017: -0.86, 2018: 0.97, 2019: 0.89,
  2020: -1.2, 2021: -0.91, 2022: -0.97, 2023: 2.06, 2024: 1.92,
  2025: -0.55, 2026: 0.98
};

let _cachedEnso = null;

export async function fetchNoaaEnsoData() {
  if (_cachedEnso) return _cachedEnso;

  try {
    const url = 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt';
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();

    const yearlyPeaks = {};
    const lines = text.split('\n');

    lines.forEach(line => {
      line = line.trim();
      if (!line || line.includes('SEAS') || line.includes('YR')) return;
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        const yr = parseInt(parts[1]);
        const anom = parseFloat(parts[3]);
        if (!isNaN(yr) && !isNaN(anom)) {
          if (!yearlyPeaks[yr]) yearlyPeaks[yr] = [];
          yearlyPeaks[yr].push(anom);
        }
      }
    });

    if (Object.keys(yearlyPeaks).length < 10) return null;

    const result = {};
    Object.entries(yearlyPeaks).forEach(([yr, vals]) => {
      const maxA = Math.max(...vals);
      const minA = Math.min(...vals);
      const peak = Math.abs(maxA) >= Math.abs(minA) ? maxA : minA;
      result[parseInt(yr)] = Number(peak.toFixed(2));
    });

    _cachedEnso = result;
    return result;
  } catch {
    return null;
  }
}

export const GLOBAL_DATASETS = {
  global: { name: 'Hele Verden (NASA GISTEMP v4 / NOAA NCEI)', shortName: 'Global', tempLabel: 'Global Temperaturøkning', baseTemp: 14.0, trendFactor: 1.0 },
  europe: { name: 'Europa Landflate (HadCRUT5 / Copernicus ERA5)', shortName: 'Europa', tempLabel: 'Temperaturøkning i Europa', baseTemp: 9.2, trendFactor: 1.4 },
  north_hemisphere: { name: 'Nordlige Halvkule (NOAA NCEI)', shortName: 'Nordlige Halvkule', tempLabel: 'Temperaturøkning Nordlige Halvkule', baseTemp: 14.8, trendFactor: 1.25 },
  tropics: { name: 'Tropene 30°N–30°S (NOAA NCEI)', shortName: 'Tropene', tempLabel: 'Temperaturøkning i Tropene', baseTemp: 25.2, trendFactor: 0.85 },
  south_hemisphere: { name: 'Sørlige Halvkule (NOAA NCEI)', shortName: 'Sørlige Halvkule', tempLabel: 'Temperaturøkning Sørlige Halvkule', baseTemp: 13.2, trendFactor: 0.75 }
};

/**
 * Historiske globale observasjoner fra NASA GISTEMP, NOAA og Copernicus (1880 - 2025)
 */
const DATASET_RAW_ANOMALIES = {
  global: [
    -0.12, -0.08, -0.10, -0.18, -0.25, -0.22, -0.20, -0.26, -0.15, -0.10,
    -0.32, -0.24, -0.30, -0.33, -0.28, -0.21, -0.11, -0.10, -0.25, -0.14,
    -0.08, -0.12, -0.24, -0.31, -0.40, -0.28, -0.20, -0.35, -0.38, -0.42,
    -0.36, -0.38, -0.32, -0.30, -0.15, -0.10, -0.28, -0.40, -0.22, -0.20,
    -0.21, -0.14, -0.24, -0.20, -0.22, -0.15,  0.02, -0.16, -0.18, -0.30,
    -0.10, -0.06, -0.12, -0.25, -0.10, -0.15, -0.12,  0.04,  0.08,  0.02,
     0.12,  0.18,  0.10,  0.15,  0.22,  0.10, -0.02, -0.04, -0.08, -0.06,
    -0.15, -0.04,  0.02,  0.10, -0.12, -0.14, -0.20,  0.05,  0.08,  0.04,
    -0.02,  0.06,  0.04,  0.08, -0.18, -0.10, -0.04, -0.02, -0.06,  0.08,
     0.04, -0.08,  0.02,  0.16, -0.06, -0.02, -0.10,  0.18,  0.08,  0.16,
     0.26,  0.32,  0.14,  0.31,  0.16,  0.12,  0.18,  0.33,  0.38,  0.28,
     0.45,  0.35,  0.22,  0.24,  0.32,  0.46,  0.35,  0.48,  0.64,  0.42,
     0.42,  0.54,  0.63,  0.62,  0.55,  0.68,  0.64,  0.66,  0.54,  0.66,
     0.72,  0.61,  0.65,  0.68,  0.75,  1.08,  1.20,  1.11,  1.04,  1.15,
     1.19,  1.03,  1.06,  1.35,  1.46,  1.33
  ],
  europe: [
    -0.35, -0.18, -0.28, -0.52, -0.61, -0.42, -0.38, -0.55, -0.31, -0.22,
    -0.68, -0.45, -0.58, -0.64, -0.52, -0.38, -0.15, -0.12, -0.48, -0.28,
    -0.18, -0.25, -0.45, -0.58, -0.72, -0.48, -0.35, -0.62, -0.65, -0.75,
    -0.62, -0.68, -0.55, -0.52, -0.18,  0.22, -0.48, -0.72, -0.35, -0.32,
    -0.38, -0.15, -0.42, -0.32, -0.40, -0.25,  0.18, -0.30, -0.35, -0.82,
    -0.12, -0.05, -0.22, -0.45,  0.42, -0.28, -0.20,  0.28,  0.45,  0.15,
    -0.45, -0.58, -0.62,  0.15,  0.38,  0.18, -0.12,  0.42, -0.22, -0.15,
    -0.42, -0.12,  0.15,  0.38, -0.35, -0.48, -0.55,  0.18,  0.22,  0.12,
    -0.12,  0.25,  0.15, -0.58, -0.45, -0.28, -0.15, -0.08, -0.18,  0.22,
     0.12, -0.15, -0.10,  0.28, -0.18,  0.35, -0.25,  0.48,  0.18, -0.12,
     0.32,  0.45,  0.12,  0.62,  0.18, -0.25,  0.12, -0.35,  0.58,  0.72,
     0.92,  0.48,  0.55,  0.35,  0.88,  0.62,  0.45,  0.78,  0.95,  0.82,
     0.85,  1.12,  1.35,  1.45,  0.98,  1.25,  1.38,  1.42,  0.88,  1.22,
     1.28,  1.15,  1.08,  1.32,  1.58,  1.62,  1.55,  1.72,  2.02,  2.15,
     2.25,  1.92,  2.18,  2.42,  2.48,  2.35
  ],
  north_hemisphere: [
    -0.15, -0.10, -0.12, -0.22, -0.30, -0.25, -0.22, -0.30, -0.18, -0.12,
    -0.38, -0.28, -0.35, -0.38, -0.32, -0.24, -0.12, -0.10, -0.28, -0.15,
    -0.09, -0.14, -0.28, -0.36, -0.46, -0.32, -0.22, -0.40, -0.44, -0.49,
    -0.42, -0.44, -0.36, -0.34, -0.16, -0.10, -0.32, -0.46, -0.24, -0.22,
    -0.24, -0.15, -0.28, -0.22, -0.25, -0.16,  0.04, -0.18, -0.20, -0.35,
    -0.08, -0.04, -0.10, -0.22,  0.15, -0.12, -0.08,  0.12,  0.18,  0.08,
     0.24,  0.32,  0.22,  0.28,  0.38,  0.18, -0.02, -0.04, -0.10, -0.06,
    -0.18, -0.04,  0.04,  0.12, -0.16, -0.18, -0.24,  0.08,  0.12,  0.06,
    -0.01,  0.09,  0.06,  0.12, -0.22, -0.12, -0.04, -0.01, -0.06,  0.11,
     0.06, -0.11,  0.04,  0.20, -0.08, -0.02, -0.12,  0.22,  0.11,  0.18,
     0.32,  0.40,  0.18,  0.38,  0.22,  0.16,  0.22,  0.40,  0.45,  0.32,
     0.52,  0.42,  0.26,  0.28,  0.38,  0.55,  0.40,  0.56,  0.75,  0.48,
     0.48,  0.62,  0.72,  0.70,  0.62,  0.78,  0.72,  0.75,  0.60,  0.74,
     0.82,  0.68,  0.72,  0.76,  0.88,  1.22,  1.38,  1.28,  1.18,  1.32,
     1.38,  1.18,  1.22,  1.56,  1.68,  1.52
  ],
  tropics: [
    -0.05, -0.02, -0.04, -0.08, -0.12, -0.10, -0.08, -0.14, -0.06, -0.02,
    -0.18, -0.12, -0.15, -0.18, -0.14, -0.09, -0.04, -0.02, -0.12, -0.06,
    -0.02, -0.05, -0.10, -0.14, -0.18, -0.12, -0.08, -0.15, -0.16, -0.20,
    -0.16, -0.18, -0.14, -0.12,  0.18, -0.04, -0.12, -0.18, -0.09, -0.08,
    -0.09, -0.05, -0.10, -0.08, -0.10,  0.32,  0.02, -0.06, -0.07, -0.12,
    -0.04, -0.02, -0.05, -0.10, -0.03, -0.06, -0.04,  0.02,  0.03,  0.01,
     0.05,  0.38,  0.08,  0.06,  0.09,  0.04, -0.01, -0.02, -0.04, -0.03,
    -0.06, -0.01,  0.01,  0.04, -0.05, -0.06, -0.08,  0.25,  0.04,  0.01,
    -0.01,  0.03,  0.01,  0.03, -0.08,  0.12, -0.01, -0.01, -0.03,  0.04,
     0.01, -0.03,  0.35,  0.12, -0.08, -0.04, -0.10,  0.08,  0.03,  0.08,
     0.12,  0.15,  0.52,  0.15,  0.06,  0.04,  0.08,  0.25,  0.18,  0.12,
     0.22,  0.15,  0.08,  0.10,  0.15,  0.22,  0.15,  0.92,  0.28,  0.18,
     0.18,  0.25,  0.35,  0.28,  0.24,  0.32,  0.28,  0.30,  0.22,  0.42,
     0.45,  0.22,  0.28,  0.30,  0.35,  1.18,  0.88,  0.62,  0.55,  0.68,
     0.62,  0.42,  0.45,  1.45,  1.32,  1.08
  ],
  south_hemisphere: [
    -0.08, -0.05, -0.06, -0.11, -0.15, -0.13, -0.11, -0.17, -0.09, -0.06,
    -0.20, -0.15, -0.18, -0.21, -0.18, -0.13, -0.08, -0.06, -0.16, -0.09,
    -0.05, -0.08, -0.15, -0.20, -0.25, -0.18, -0.12, -0.22, -0.24, -0.28,
    -0.22, -0.24, -0.20, -0.18, -0.09, -0.06, -0.18, -0.25, -0.14, -0.12,
    -0.13, -0.08, -0.15, -0.12, -0.14, -0.09,  0.01, -0.10, -0.11, -0.18,
    -0.06, -0.03, -0.08, -0.15, -0.05, -0.09, -0.07,  0.02,  0.04,  0.01,
     0.04,  0.08,  0.02,  0.05,  0.08,  0.04, -0.01, -0.02, -0.04, -0.03,
    -0.08, -0.02,  0.01,  0.05, -0.06, -0.07, -0.09,  0.02,  0.04,  0.02,
    -0.02,  0.04,  0.02,  0.04, -0.10, -0.05, -0.02, -0.01, -0.04,  0.05,
     0.02, -0.04,  0.01,  0.10, -0.04, -0.01, -0.12,  0.10,  0.04,  0.10,
     0.15,  0.20,  0.09,  0.20,  0.10,  0.08,  0.11,  0.20,  0.24,  0.18,
     0.32,  0.24,  0.15,  0.18,  0.22,  0.32,  0.25,  0.35,  0.48,  0.32,
     0.32,  0.40,  0.48,  0.46,  0.42,  0.50,  0.48,  0.49,  0.42,  0.49,
     0.54,  0.45,  0.49,  0.52,  0.58,  0.85,  0.92,  0.84,  0.78,  0.88,
     0.92,  0.78,  0.82,  1.05,  1.18,  1.02
  ]
};

export function getGlobalClimateSeries(datasetKey = 'global') {
  const rawAnomalies = DATASET_RAW_ANOMALIES[datasetKey] || DATASET_RAW_ANOMALIES.global;

  const realSeaIceMin = {
    1979: 6.90, 1980: 7.53, 1981: 6.90, 1982: 7.16, 1983: 7.20, 1984: 6.39, 1985: 6.70, 1986: 7.12, 1987: 6.89, 1988: 7.05, 1989: 6.89,
    1990: 6.01, 1991: 6.29, 1992: 7.21, 1993: 6.16, 1994: 6.93, 1995: 6.08, 1996: 7.19, 1997: 6.62, 1998: 6.29, 1999: 5.68,
    2000: 5.98, 2001: 6.59, 2002: 5.67, 2003: 5.97, 2004: 5.77, 2005: 5.31, 2006: 5.75, 2007: 4.15, 2008: 4.59, 2009: 5.06,
    2010: 4.60, 2011: 4.33, 2012: 3.39, 2013: 5.04, 2014: 5.03, 2015: 4.43, 2016: 4.14, 2017: 4.64, 2018: 4.59, 2019: 4.19,
    2020: 3.82, 2021: 4.72, 2022: 4.67, 2023: 4.23, 2024: 4.28, 2025: 4.10
  };

  // CO2 data: Law Dome ice core (1880–1958) + NOAA GML Mauna Loa (1959–2025)
  // Ice core: MacFarling Meure et al. 2006, Law Dome, Antarctica
  // Mauna Loa: Keeling et al. / NOAA GML (gml.noaa.gov/ccgg/trends/)
  // Live NOAA fetch updates this at runtime if available.
  const co2Lookup = (_cachedCo2 && Object.keys(_cachedCo2).length > 10)
    ? _cachedCo2
    : NOAA_CO2_PPM;

  // Sea level: use the live NOAA data if available (populated async), else fallback to NOAA_SEA_LEVEL_MM
  const seaLevelLookup = (_cachedSeaLevel && Object.keys(_cachedSeaLevel).length > 10)
    ? _cachedSeaLevel
    : NOAA_SEA_LEVEL_MM;

  // ENSO ONI index: use live NOAA CPC data if available, else fallback to NOAA_ENSO_ONI
  const ensoLookup = (_cachedEnso && Object.keys(_cachedEnso).length > 10)
    ? _cachedEnso
    : NOAA_ENSO_ONI;

  const years = [];
  const startYear = 1880;
  const endYear = 2025;

  for (let y = startYear; y <= endYear; y++) {
    const idx = y - startYear;
    const co2 = co2Lookup[y] !== undefined ? co2Lookup[y] : 427.0;
    const tempAnomaly = rawAnomalies[idx] !== undefined ? rawAnomalies[idx] : 1.33;
    const seaLevelMm = seaLevelLookup[y] !== undefined ? seaLevelLookup[y] : null;
    const ensoOni = ensoLookup[y] !== undefined ? ensoLookup[y] : null;
    
    let arcticIceArea = 7.8 - ((y - 1880) / 145) * 1.5;
    if (realSeaIceMin[y] !== undefined) {
      arcticIceArea = realSeaIceMin[y];
    }

    years.push({
      year: y,
      co2Ppm: Number(co2.toFixed(1)),
      tempAnomaly: tempAnomaly,
      seaLevelMm: seaLevelMm,
      arcticIceArea: Number(arcticIceArea.toFixed(2)),
      ensoOni: ensoOni
    });
  }

  return years.map((item, idx) => {
    const windowStart = Math.max(0, idx - 5);
    const windowEnd = Math.min(years.length - 1, idx + 4);
    const slice = years.slice(windowStart, windowEnd + 1);
    const avgAnomaly = slice.reduce((acc, curr) => acc + curr.tempAnomaly, 0) / slice.length;

    return {
      ...item,
      trendAnomaly: Number(avgAnomaly.toFixed(2))
    };
  });
}

/**
 * Henter globale klimadata tilpasset valgt område og variabel
 */
export function getGlobalDataForRegion(regionKey = 'global') {
  const dataset = GLOBAL_DATASETS[regionKey] || GLOBAL_DATASETS.global;
  const rawSeries = getGlobalClimateSeries(regionKey);

  const series = rawSeries.map(item => {
    const anomaly = item.tempAnomaly;
    const trend = item.trendAnomaly;
    const absTemp = Number((dataset.baseTemp + anomaly).toFixed(1));
    const absTrend = Number((dataset.baseTemp + trend).toFixed(2));

    return {
      ...item,
      anomaly,
      trend,
      absTemp,
      absTrend
    };
  });

  const latest = series[series.length - 1];

  const records = {
    warmestYears: [...series].sort((a, b) => b.anomaly - a.anomaly).slice(0, 10),
    coldestYears: [...series].sort((a, b) => a.anomaly - b.anomaly).slice(0, 10),
    elNinoEvents: [
      { year: '2023–2024', name: 'Super El Niño (Rekordår)', rate: '+1.46 °C' },
      { year: '2015–2016', name: 'Super El Niño ("Godzilla")', rate: '+1.20 °C' },
      { year: '1997–1998', name: 'Århundrets El Niño', rate: '+0.64 °C' },
      { year: '1982–1983', name: 'Historisk Ekstrem-El Niño', rate: '+0.31 °C' },
      { year: '1972–1973', name: 'Kraftig El Niño', rate: '+0.16 °C' },
      { year: '2009–2010', name: 'Moderat/Sterk El Niño', rate: '+0.72 °C' },
      { year: '2002–2003', name: 'Moderat El Niño', rate: '+0.63 °C' },
      { year: '1991–1992', name: 'El Niño (Pinatubo-kjølt)', rate: '+0.35 °C' },
      { year: '1965–1966', name: 'Moderat Stillehavs-El Niño', rate: '-0.04 °C' },
      { year: '1957–1958', name: 'Internasjonal Geofysisk El Niño', rate: '+0.08 °C' }
    ],
    laNinaEvents: [
      { year: '2010–2011', name: 'Ekstrem La Niña (Havstigningsfall)', rate: '+0.61 °C' },
      { year: '1973–1976', name: 'Langvarig Super-La Niña', rate: '-0.06 °C' },
      { year: '1988–1989', name: 'Kraftig Post-El Niño La Niña', rate: '+0.28 °C' },
      { year: '1998–2000', name: 'Dobbelt La Niña-kjøling', rate: '+0.42 °C' },
      { year: '2020–2023', name: 'Sjelden "Triple-Dip" La Niña', rate: '+1.03 °C' },
      { year: '2007–2008', name: 'Sterk La Niña-kjøling', rate: '+0.54 °C' },
      { year: '1954–1956', name: 'Flerårig La Niña-periode', rate: '-0.14 °C' },
      { year: '1964–1965', name: 'Sterk La Niña (Post-Agung)', rate: '-0.10 °C' },
      { year: '1995–1996', name: 'Moderat Stillehavs-La Niña', rate: '+0.35 °C' },
      { year: '2011–2012', name: 'Oppfølgende La Niña-kjøling', rate: '+0.65 °C' }
    ]
  };

  // Find most recent year with NOAA sea level reading
  const latestSeaEntry = [...series].reverse().find(s => s.seaLevelMm !== null && s.seaLevelMm !== undefined);

  return {
    regionName: dataset.name,
    tempLabel: dataset.tempLabel || 'Global Temperaturøkning',
    series,
    records,
    kpis: {
      globalTempAnomaly: latest.anomaly,
      currentCo2Ppm: latest.co2Ppm,
      seaLevelMm: latestSeaEntry ? latestSeaEntry.seaLevelMm : null,
      seaLevelRiseMm: latestSeaEntry ? latestSeaEntry.seaLevelMm : null,
      arcticIceArea: latest.arcticIceArea,
      arcticIceMin: latest.arcticIceArea
    }
  };
}
