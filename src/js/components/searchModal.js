/* ==========================================================================
   VÆR OG KLIMA I NORGE - SEARCH MODAL COMPONENT
   ========================================================================== */

import { searchLocation } from '../api/weatherApi.js';

let activeBoxIndex = 0;
let onSelectSearchResultCallback = null;
let searchDebounceTimer = null;

export function initSearchModal(onSelectResult) {
  onSelectSearchResultCallback = onSelectResult;

  const modal = document.getElementById('search-modal');
  const closeBtn = document.getElementById('modal-close');
  const searchInput = document.getElementById('search-input');
  const resultsContainer = document.getElementById('search-results');

  // Lukkeknapp
  closeBtn.addEventListener('click', closeSearchModal);

  // Klikk utenfor modal for å lukke
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeSearchModal();
    }
  });

  // Debounced input-søking
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchDebounceTimer);

    if (query.length < 2) {
      resultsContainer.innerHTML = '<div class="search-placeholder-msg">Skriv inn minst 2 tegn for å søke...</div>';
      return;
    }

    resultsContainer.innerHTML = '<div class="search-placeholder-msg">Søker etter steder i Norge...</div>';

    searchDebounceTimer = setTimeout(async () => {
      const results = await searchLocation(query);
      renderSearchResults(results);
    }, 250);
  });
}

export function openSearchModal(boxIndex, currentCity) {
  activeBoxIndex = boxIndex;
  const modal = document.getElementById('search-modal');
  const boxTitle = document.getElementById('modal-box-index-title');
  const searchInput = document.getElementById('search-input');
  const resultsContainer = document.getElementById('search-results');

  if (boxTitle) boxTitle.textContent = `#${boxIndex + 1} (${currentCity.name})`;
  if (searchInput) {
    searchInput.value = '';
    setTimeout(() => searchInput.focus(), 100);
  }
  if (resultsContainer) {
    resultsContainer.innerHTML = '<div class="search-placeholder-msg">Skriv inn et stedsnavn i Norge...</div>';
  }

  modal.classList.remove('hidden');
}

export function closeSearchModal() {
  const modal = document.getElementById('search-modal');
  if (modal) modal.classList.add('hidden');
}

function renderSearchResults(results) {
  const resultsContainer = document.getElementById('search-results');
  if (!resultsContainer) return;

  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="search-placeholder-msg">Ingen norske steder funnet. Prøv et annet stedsnavn.</div>';
    return;
  }

  resultsContainer.innerHTML = results.map((item, idx) => `
    <div class="search-result-item" data-index="${idx}">
      <div>
        <div class="result-name">${item.name}</div>
        <div class="result-sub">${item.region}</div>
      </div>
      <span class="btn-secondary btn-sm">Velg sted</span>
    </div>
  `).join('');

  // Klikk-håndterer for resultat
  resultsContainer.querySelectorAll('.search-result-item').forEach((el, idx) => {
    el.addEventListener('click', () => {
      const selectedItem = results[idx];
      if (onSelectSearchResultCallback) {
        onSelectSearchResultCallback(activeBoxIndex, selectedItem);
      }
      closeSearchModal();
    });
  });
}
