/* ==========================================================================
   VÆR OG KLIMA I NORGE - MAIN APPLICATION ENTRY POINT
   ========================================================================== */

import { initExtremes } from './components/extremes.js';
import { initCityCards, updateCityCard, getCurrentSelectedCity } from './components/cityCards.js';
import { initSearchModal, openSearchModal } from './components/searchModal.js';
import { initForecastSection, loadForecastForLocation } from './components/forecastChart.js';
import { initClimateView, updateClimateDashboard } from './components/climateView.js';
import { initGlobalClimateView, updateGlobalDashboard } from './components/globalClimateView.js';

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  initAppModules();
});

function setupNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabViews = document.querySelectorAll('.tab-view');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabViews.forEach(view => {
        if (view.id === `view-${targetTab}`) {
          view.classList.add('active');
        } else {
          view.classList.remove('active');
        }
      });

      // Re-rendre grafer når fanen blir synlig i DOM
      setTimeout(() => {
        if (targetTab === 'global') {
          updateGlobalDashboard();
        } else if (targetTab === 'climate') {
          updateClimateDashboard();
        }
      }, 30);
    });
  });
}

async function initAppModules() {
  // 1. Initier prognosegraf-komponenten
  initForecastSection();

  // 2. Initier steds-søk modal (for dobbeltklikk)
  initSearchModal((boxIndex, newLocation) => {
    updateCityCard(boxIndex, newLocation);
    loadForecastForLocation(newLocation);
  });

  // 3. Initier 10 By-kort
  initCityCards(
    (selectedCity, isHome = false) => {
      loadForecastForLocation(selectedCity, isHome);
    },
    (boxIndex, currentCity) => {
      openSearchModal(boxIndex, currentCity);
    }
  );

  // 4. Initier Topp 10 ekstremvær
  initExtremes((selectedExtremeLocation) => {
    loadForecastForLocation(selectedExtremeLocation);
    const forecastEl = document.getElementById('forecast-section');
    if (forecastEl) {
      forecastEl.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // 5. Initier Klima i Norge-fanen
  initClimateView();

  // 6. Initier Globalt Klima-fanen
  initGlobalClimateView();
}
