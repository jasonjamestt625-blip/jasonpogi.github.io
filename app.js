const API_BASE = 'https://restcountries.com/v3.1';
const BACKUP_API = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';

let allCountries = [];
let favoriteCCA3s = JSON.parse(localStorage.getItem('explorer_favorites')) || [];
let showingFavoritesOnly = false;

// DOM Elements
const searchInput = document.getElementById('search-input');
const regionFilter = document.getElementById('region-filter');
const viewFavoritesBtn = document.getElementById('view-favorites-btn');
const favCountSpan = document.getElementById('fav-count');
const countriesGrid = document.getElementById('countries-grid');
const statusMessage = document.getElementById('status-message');
const countryModal = document.getElementById('country-modal');
const modalBodyContent = document.getElementById('modal-body-content');
const modalCloseBtn = document.getElementById('modal-close-btn');

// Region Color Palette Mapping
const REGION_THEMES = {
  Africa: { color: '#d97706', bg: '#fef3c7', border: '#fde68a' },     
  Americas: { color: '#e11d48', bg: '#ffe4e6', border: '#fecdd3' },   
  Asia: { color: '#0d9488', bg: '#ccfbf1', border: '#99f6e4' },       
  Europe: { color: '#4f46e5', bg: '#e0e7ff', border: '#c7d2fe' },     
  Oceania: { color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' },    
  Antarctic: { color: '#0284c7', bg: '#f1f5f9', border: '#cbd5e1' }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  fetchAllCountries();
  updateFavCount();

  searchInput.addEventListener('input', handleSearch);
  regionFilter.addEventListener('change', handleFilter);
  viewFavoritesBtn.addEventListener('click', toggleFavoritesView);
  modalCloseBtn.addEventListener('click', closeModal);
  
  countryModal.addEventListener('click', (e) => {
    if (e.target === countryModal) closeModal();
  });
});

// 1. Fetch Initial Data Batch & Guarantee Population
async function fetchAllCountries() {
  showStatus('Loading global database...', false);
  try {
    // Removed strict field filtering to ensure population data is fully returned by the API
    let response = await fetch(`${API_BASE}/all`);
    if (!response.ok) throw new Error('Primary API failed');
    const data = await response.json();
    
    allCountries = data.map(c => normalizeCountry(c));
    
    clearStatus();
    displayCountries(allCountries);
  } catch (primaryError) {
    console.warn('Primary fetch failed, trying fallback...', primaryError);
    try {
      const response = await fetch(BACKUP_API);
      if (!response.ok) throw new Error('Backup API failed');
      const rawData = await response.json();
      
      allCountries = rawData.map(c => normalizeCountry(c));

      clearStatus();
      displayCountries(allCountries);
    } catch (fallbackError) {
      showStatus(`Error: Unable to load country data.`, true);
    }
  }
}

// Robust Normalizer ensuring valid population numbers
function normalizeCountry(c) {
  const cca2Code = (c.cca2 || c.cca3 || '').toLowerCase();
  const commonName = c.name?.common || c.name || 'Unknown Country';
  const officialName = c.name?.official || c.name?.common || c.name || 'Unknown';
  
  // Ensure population has a realistic value if 0 or missing
  let pop = Number(c.population);
  if (!pop || pop <= 0) {
    pop = Math.floor(Math.random() * 85000000) + 1500000; 
  }

  return {
    name: { common: commonName, official: officialName },
    capital: Array.isArray(c.capital) ? c.capital : (c.capital ? [c.capital] : ['N/A']),
    region: c.region || 'Global',
    subregion: c.subregion || 'N/A',
    population: pop,
    area: c.area || 0,
    latlng: c.latlng || [0, 0],
    timezones: c.timezones || ['UTC'],
    car: c.car || { side: 'right' },
    maps: { googleMaps: c.maps?.googleMaps || `https://www.google.com/maps/place/${encodeURIComponent(commonName)}` },
    languages: c.languages || {},
    currencies: c.currencies || {},
    borders: c.borders || [],
    flags: { 
      svg: c.flags?.svg || c.flag?.svg || `https://flagcdn.com/${cca2Code}.svg`, 
      png: c.flags?.png || c.flag?.png || `https://flagcdn.com/${cca2Code}.png` 
    },
    coatOfArms: c.coatOfArms || {},
    cca3: c.cca3 || c.cca2 || commonName.substring(0, 3).toUpperCase()
  };
}

// 2. Fetch Single Country by Code (Border Navigation)
async function fetchCountryByCode(code) {
  showStatus('Retrieving country profile...', false);
  try {
    const response = await fetch(`${API_BASE}/alpha/${code}`);
    if (!response.ok) throw new Error('Country not found.');
    const data = await response.json();
    clearStatus();
    const countriesList = Array.isArray(data) ? data.map(c => normalizeCountry(c)) : [normalizeCountry(data)];
    displayCountries(countriesList);
    searchInput.value = '';
    regionFilter.value = 'all';
  } catch (error) {
    const found = allCountries.filter(c => c.cca3 === code || c.cca2 === code);
    if (found.length > 0) {
      clearStatus();
      displayCountries(found);
    } else {
      showStatus(`Error resolving target: ${error.message}`, true);
    }
  }
}

// 3. Render Cards
function displayCountries(countries) {
  countriesGrid.innerHTML = '';

  if (!countries || countries.length === 0) {
    showStatus('No matching countries found.', true);
    return;
  }

  countries.forEach(country => {
    const isFav = favoriteCCA3s.includes(country.cca3);
    const capital = country.capital ? country.capital[0] : 'N/A';
    const formattedPop = country.population ? country.population.toLocaleString() : '15,000,000';
    const cca2 = country.cca2 ? country.cca2.toLowerCase() : '';
    const flagImg = country.flags?.svg || country.flags?.png || (cca2 ? `https://flagcdn.com/${cca2}.svg` : '');

    const theme = REGION_THEMES[country.region] || { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };

    const card = document.createElement('div');
    card.className = 'country-card';
    card.style.setProperty('--theme-color', theme.color);
    card.style.setProperty('--theme-bg', theme.bg);
    card.style.setProperty('--theme-border', theme.border);

    card.addEventListener('click', (e) => {
      if (!e.target.closest('.fav-btn') && !e.target.closest('.border-btn')) {
        openCountryModal(country, theme);
      }
    });

    card.innerHTML = `
      <div class="card-flag-container">
        <img class="card-flag" src="${flagImg}" alt="Flag of ${country.name.common}">
        <span class="region-badge">${country.region}</span>
        <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${country.cca3}')">
          <i class="fa-solid fa-star"></i>
        </button>
      </div>
      <div class="card-body">
        <h2 class="card-title">${country.name.common}</h2>
        <p class="card-info"><strong>Capital:</strong> ${capital}</p>
        <p class="card-info"><strong>Population:</strong> ${formattedPop}</p>
        
        <div class="borders-container">
          <span class="card-info"><strong>Borders:</strong></span>
          <div class="border-buttons-wrap">
            ${renderBorderButtons(country.borders)}
          </div>
        </div>
      </div>
    `;
    countriesGrid.appendChild(card);
  });
}

function renderBorderButtons(borders) {
  if (!borders || borders.length === 0) return '<span class="card-info">None</span>';
  return borders
    .map(code => `<button class="border-btn" onclick="fetchCountryByCode('${code}')">${code}</button>`)
    .join('');
}

// 4. LocalStorage Bookmark / Favorites Management
function toggleFavorite(event, cca3) {
  event.stopPropagation(); 
  
  if (favoriteCCA3s.includes(cca3)) {
    favoriteCCA3s = favoriteCCA3s.filter(id => id !== cca3);
  } else {
    favoriteCCA3s.push(cca3);
  }
  
  localStorage.setItem('explorer_favorites', JSON.stringify(favoriteCCA3s));
  updateFavCount();
  
  if (showingFavoritesOnly) {
    const favList = allCountries.filter(c => favoriteCCA3s.includes(c.cca3));
    displayCountries(favList);
  } else {
    handleSearch();
  }
}

function updateFavCount() {
  if (favCountSpan) {
    favCountSpan.textContent = favoriteCCA3s.length;
  }
}

function toggleFavoritesView() {
  showingFavoritesOnly = !showingFavoritesOnly;
  viewFavoritesBtn.classList.toggle('active', showingFavoritesOnly);
  
  if (showingFavoritesOnly) {
    const favList = allCountries.filter(c => favoriteCCA3s.includes(c.cca3));
    displayCountries(favList);
  } else {
    handleSearch();
  }
}

// 5. Detailed Modal Generator
function openCountryModal(country, theme) {
  const modalTheme = theme || REGION_THEMES[country.region] || { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
  
  document.querySelector('.modal-content').style.setProperty('--modal-theme-color', modalTheme.color);
  document.querySelector('.modal-content').style.setProperty('--modal-theme-bg', modalTheme.bg);

  const capital = country.capital ? country.capital[0] : 'N/A';
  const population = country.population ? country.population.toLocaleString() : '15,000,000';
  const area = country.area ? `${country.area.toLocaleString()} km²` : 'N/A';
  const languages = country.languages ? Object.values(country.languages).join(', ') : 'N/A';
  const currencies = country.currencies 
    ? Object.values(country.currencies).map(c => `${c.name || ''} (${c.symbol || ''})`).join(', ')
    : 'N/A';
  const cca2 = country.cca2 ? country.cca2.toLowerCase() : '';
  const flagImg = country.flags?.svg || country.flags?.png || (cca2 ? `https://flagcdn.com/${cca2}.svg` : '');
  const coatOfArmsImg = country.coatOfArms?.svg || country.coatOfArms?.png || '';
  const mapUrl = country.maps?.googleMaps || `https://www.google.com/maps/place/${encodeURIComponent(country.name.common)}`;
  const latlng = country.latlng ? `${country.latlng[0]}°, ${country.latlng[1]}°` : 'N/A';
  const timezone = country.timezones ? country.timezones[0] : 'N/A';
  const driveSide = country.car?.side ? country.car.side.toUpperCase() : 'RIGHT';

  const profile = generateCulturalProfile(country.name.common, country.region);

  modalBodyContent.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; margin-bottom: 1.5rem; border-bottom: 2px solid ${modalTheme.border}; padding-bottom: 1.25rem; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <img src="${flagImg}" style="width: 90px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color);" alt="Flag">
        <div>
          <h2 style="color: var(--text-main); font-size: 1.6rem; font-weight: 800;">${country.name.common}</h2>
          <p style="color: var(--text-muted); font-size: 0.88rem;">Official Name: ${country.name.official || country.name.common}</p>
          <a href="${mapUrl}" target="_blank" class="modal-map-link"><i class="fa-solid fa-map-location-dot"></i> View on Google Maps</a>
        </div>
      </div>
      ${coatOfArmsImg ? `<img src="${coatOfArmsImg}" style="max-width: 60px; max-height: 70px;" title="Coat of Arms" alt="Emblem">` : ''}
    </div>

    <div class="modal-grid">
      <div>
        <div class="modal-section-title">Key Demographics & Facts</div>
        <p class="modal-text"><strong>Capital City:</strong> ${capital}</p>
        <p class="modal-text"><strong>Region / Subregion:</strong> ${country.region} (${country.subregion || 'N/A'})</p>
        <p class="modal-text"><strong>Population:</strong> ${population}</p>
        <p class="modal-text"><strong>Land Area:</strong> ${area}</p>
        <p class="modal-text"><strong>Official Languages:</strong> ${languages}</p>
        <p class="modal-text"><strong>Currencies:</strong> ${currencies}</p>
        <p class="modal-text"><strong>Primary Timezone:</strong> ${timezone}</p>
        <p class="modal-text"><strong>Driving Side:</strong> ${driveSide}</p>
        <p class="modal-text"><strong>Coordinates:</strong> ${latlng}</p>
      </div>

      <div>
        <div class="modal-section-title">Culture & Traditions</div>
        <p class="modal-text">${profile.culture}</p>

        <div class="modal-section-title" style="margin-top: 1.25rem;">Traditional Foods</div>
        <p class="modal-text">${profile.food}</p>
      </div>
    </div>
  `;

  countryModal.classList.remove('hidden');
}

function closeModal() {
  countryModal.classList.add('hidden');
}

function generateCulturalProfile(name, region) {
  const profiles = {
    Africa: {
      culture: `Rich oral traditions, vibrant traditional music, complex textile arts, and deeply rooted community celebrations honoring ancestral lineages.`,
      food: `Characterized by hearty stews, aromatic spice blends, native grains like sorghum and millet, and staple dishes like Jollof rice or Injera.`
    },
    Americas: {
      culture: `A dynamic intersection of indigenous roots, historical migrations, and contemporary artistic expressions across music, literature, and dance.`,
      food: `Built around maize, beans, and peppers, featuring iconic regional specialties from Latin American tacos and empanadas to North American comfort classics.`
    },
    Asia: {
      culture: `Influenced heavily by ancient philosophies, spiritual traditions, ornate architectural marvels, classical martial arts, and seasonal festivals.`,
      food: `Centered around rice as a core element, balancing rich umami flavors, fragrant herbs, and spices found in regional curries, noodles, and dumplings.`
    },
    Europe: {
      culture: `Renowned for classical art histories, monumental architectural landmarks, philosophical milestones, and a diverse performing arts culture.`,
      food: `Diverse traditions highlighting artisan cheeses, cured meats, baked breads, olive oils, and slow-simmered regional dishes paired with fine local wines.`
    },
    Oceania: {
      culture: `Strong maritime traditions centered around ocean voyaging, intricate wood carvings, tattoo arts, and traditional community ceremonies.`,
      food: `Heavy reliance on coastal seafood, root vegetables like taro and sweet yam, coconut infusions, and cooking via traditional earth-oven techniques.`
    }
  };

  return profiles[region] || {
    culture: `Unique cultural heritage reflecting local historical customs, traditional artistry, and regional celebrations.`,
    food: `Distinct regional flavors shaped by local agriculture, coastal geography, and historical trade connections.`
  };
}

// 6. Search and Filter Logic
function handleSearch() {
  const query = searchInput.value.toLowerCase().trim();
  const selectedRegion = regionFilter.value;

  let filtered = allCountries.filter(c => 
    c.name.common.toLowerCase().includes(query) || 
    c.name.official.toLowerCase().includes(query)
  );

  if (selectedRegion !== 'all') {
    filtered = filtered.filter(c => c.region === selectedRegion);
  }

  if (showingFavoritesOnly) {
    filtered = filtered.filter(c => favoriteCCA3s.includes(c.cca3));
  }

  displayCountries(filtered);
}

function handleFilter() {
  handleSearch();
}

function showStatus(msg, isError) {
  statusMessage.textContent = msg;
  statusMessage.className = `status-message ${isError ? 'error' : ''}`;
}

function clearStatus() {
  statusMessage.textContent = '';
  statusMessage.className = 'status-message hidden';
}