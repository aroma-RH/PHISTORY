// Constants
const API_URL = 'https://script.google.com/macros/s/AKfycbz56eAfrlk-gCq-BlilFcYoIXMZXjmcy1PxX8-mwBXgVFwA7csyy8pca3YqckXvXq-eRQ/exec';
const ROWS_PER_PAGE = 25;

// State
let allData = [];
let filteredData = [];
let currentPage = 1;
let loading = false;
let error = null;

// DOM Elements
const elements = {
  startDate: document.getElementById('startDate'),
  endDate: document.getElementById('endDate'),
  teamFilter: document.getElementById('teamFilter'),
  fincaFilter: document.getElementById('fincaFilter'),
  searchInput: document.getElementById('searchInput'),
  exportCSV: document.getElementById('exportCSV'),
  printView: document.getElementById('printView'),
  workHoursTable: document.getElementById('workHoursTable'),
  loadingSpinner: document.getElementById('loadingSpinner'),
  errorMessage: document.getElementById('errorMessage'),
  errorText: document.getElementById('errorText'),
  retryButton: document.getElementById('retryButton'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  pageNumbers: document.getElementById('pageNumbers'),
  totalEntries: document.getElementById('totalEntries'),
  totalEntriesDisplay: document.getElementById('totalEntriesDisplay'),
  totalHours: document.getElementById('totalHours'),
  avgHours: document.getElementById('avgHours'),
  overtimePercent: document.getElementById('overtimePercent'),
  themeToggle: document.getElementById('themeToggle'),
  currentYear: document.getElementById('currentYear')
};

// Initialize
async function init() {
  elements.currentYear.textContent = new Date().getFullYear();
  setupEventListeners();
  await loadData();
  initializeTheme();
}

// Theme handling
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  updateThemeToggleButton(savedTheme);
}

function updateThemeToggleButton(theme) {
  elements.themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
  elements.themeToggle.setAttribute('aria-label', 
    theme === 'light' ? 'Enable dark mode' : 'Enable light mode'
  );
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  const theme = isDark ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
  updateThemeToggleButton(theme);
}

// Event Listeners
function setupEventListeners() {
  elements.startDate.addEventListener('change', handleFiltersChange);
  elements.endDate.addEventListener('change', handleFiltersChange);
  elements.teamFilter.addEventListener('change', handleFiltersChange);
  elements.fincaFilter.addEventListener('change', handleFiltersChange);
  elements.searchInput.addEventListener('input', handleFiltersChange);
  elements.exportCSV.addEventListener('click', exportToCSV);
  elements.printView.addEventListener('click', openPrintView);
  elements.prevPage.addEventListener('click', () => changePage(currentPage - 1));
  elements.nextPage.addEventListener('click', () => changePage(currentPage + 1));
  elements.retryButton.addEventListener('click', loadData);
  elements.themeToggle.addEventListener('click', toggleTheme);
}

// Data Loading
async function loadData() {
  let retryCount = 0;
  const maxRetries = 3;
  
  const tryLoad = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      allData = processData(data);
      filteredData = [...allData];
      
      updateFilterOptions();
      updateTable();
      updateSummaryStats();
      
      setLoading(false);
    } catch (err) {
      console.error('Erreur lors du chargement des données:', err);
      
      if (retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(tryLoad, delay);
      } else {
        setError('Échec du chargement des données. Veuillez réessayer..');
        setLoading(false);
      }
    }
  };
  
  await tryLoad();
}

// Data Processing
function processData(rawData) {
  if (!Array.isArray(rawData)) {
    console.error('Format de données non valide reçu:', rawData);
    return [];
  }
  
  return rawData.map(item => ({
    id: item[0]?.toString() || '',
    employee: item[1] || 'Inconnue',
    team: item[2] || '',
    hours: parseFloat(item[3]) || 0,
    date: parseDate(item[4]),
    finca: item[5] || '',
    face: item[6] || '',
    status: item[7] || '',
    company: item[8] || ''
  }));
}
// Sélectionner les éléments
const searchInput = document.getElementById('searchInput');
const teamFilter = document.getElementById('teamFilter');
const fincaFilter = document.getElementById('fincaFilter');
const exportButton = document.getElementById('exportCSV');

// Fonction pour vérifier l'état
function updateExportButtonVisibility() {
  const isInputFilled = searchInput.value.trim() !== "";
  const isTeamSelected = teamFilter.value.trim() !== "";
  const isFincaSelected = fincaFilter.value.trim() !== "";

  if (isInputFilled || isTeamSelected || isFincaSelected) {
    exportButton.style.display = "inline-block"; // ou "block" selon ton style
  } else {
    exportButton.style.display = "none";
  }
}

// Mettre à jour au changement
searchInput.addEventListener('input', updateExportButtonVisibility);
teamFilter.addEventListener('change', updateExportButtonVisibility);
fincaFilter.addEventListener('change', updateExportButtonVisibility);

// Appel initial (au cas où tout est vide au début)
updateExportButtonVisibility();

function parseDate(dateStr) {
  if (!dateStr) return new Date();
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0]) - 1;
    const day = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    return new Date(year, month, day);
  }
  
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? new Date() : date;
}

function handleFiltersChange() {
  const filters = {
    startDate: elements.startDate.value ? new Date(elements.startDate.value) : null,
    endDate: elements.endDate.value ? new Date(elements.endDate.value) : null,
    team: elements.teamFilter.value,
    finca: elements.fincaFilter.value,
    searchTerm: elements.searchInput.value
  };
  
  filteredData = allData.filter(entry => {
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      // فلترة على اسم العامل أو رقم العامل (ID)
      const match =
        (entry.employee && typeof entry.employee === 'string' && entry.employee.toLowerCase().includes(term)) ||
        (entry.id && typeof entry.id === 'string' && entry.id.toLowerCase().includes(term));
      
      if (!match) return false;
    }
    
    // باقي الفلاتر (التاريخ، الفريق، الضيعة)
    if (filters.startDate && new Date(entry.date) < filters.startDate) return false;
    if (filters.endDate && new Date(entry.date) > filters.endDate) return false;
    if (filters.team && entry.team !== filters.team) return false;
    if (filters.finca && entry.finca !== filters.finca) return false;
  
    return true;
  });
  
  currentPage = 1;
  updateTable();
  updateSummaryStats();
}


// UI Updates
function updateFilterOptions() {
  const teams = [...new Set(allData.map(entry => entry.team))].filter(Boolean).sort();
  elements.teamFilter.innerHTML = '<option value="">Toutes les équipes</option>' +
    teams.map(team => `<option value="${team}">${team}</option>`).join('');
  
  const fincas = [...new Set(allData.map(entry => entry.finca))].filter(Boolean).sort();
  elements.fincaFilter.innerHTML = '<option value="">Toutes les Finca</option>' +
    fincas.map(finca => `<option value="${finca}">${finca}</option>`).join('');
}

function updateTable() {
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const pageData = filteredData.slice(startIndex, endIndex);
  
  const tbody = elements.workHoursTable.querySelector('tbody');
  tbody.innerHTML = pageData.length ? pageData.map(entry => `
    <tr class="${entry.hours > 8 ? 'overtime' : ''}">
      <td>${entry.id}</td>
      <td>${entry.employee}</td>
      <td>${entry.team || '-'}</td>
      <td>${entry.hours}</td>
      <td>${formatDate(entry.date)}</td>
      <td>${entry.finca || '-'}</td>
      <td>${entry.face || '-'}</td>
      <td>${entry.status || '-'}</td>
      <td>${entry.company || '-'}</td>
    </tr>
  `).join('') : `
    <tr>
      <td colspan="9" class="text-center">Aucune donnée trouvée correspondant à vos filtres</td>
    </tr>
  `;
  
  updatePagination(totalPages);
}

function updateSummaryStats() {
  const totalHours = filteredData.reduce((sum, entry) => sum + entry.hours, 0);
  const avgHours = filteredData.length > 0 ? totalHours / filteredData.length : 0;
  const overtimeEntries = filteredData.filter(entry => entry.hours > 8).length;
  const overtimePercent = filteredData.length > 0 
    ? Math.round((overtimeEntries / filteredData.length) * 100)
    : 0;

  // Add null checks before updating elements
  if (elements.totalEntries) elements.totalEntries.textContent = filteredData.length;
  if (elements.totalEntriesDisplay) elements.totalEntriesDisplay.textContent = filteredData.length;
  if (elements.totalHours) elements.totalHours.textContent = totalHours.toFixed(1);
  if (elements.avgHours) elements.avgHours.textContent = avgHours.toFixed(1);
  if (elements.overtimePercent) elements.overtimePercent.textContent = `${overtimePercent}%`;
}

function updatePagination(totalPages) {
  elements.prevPage.disabled = currentPage === 1;
  elements.nextPage.disabled = currentPage === totalPages;
  
  const pageNumbers = [];
  const maxVisiblePages = 5;
  
  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    const leftSiblingIndex = Math.max(currentPage - 1, 1);
    const rightSiblingIndex = Math.min(currentPage + 1, totalPages);
    
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;
    
    if (!shouldShowLeftDots && shouldShowRightDots) {
      for (let i = 1; i <= 3; i++) pageNumbers.push(i);
      pageNumbers.push('...');
      pageNumbers.push(totalPages);
    } else if (shouldShowLeftDots && !shouldShowRightDots) {
      pageNumbers.push(1);
      pageNumbers.push('...');
      for (let i = totalPages - 2; i <= totalPages; i++) pageNumbers.push(i);
    } else if (shouldShowLeftDots && shouldShowRightDots) {
      pageNumbers.push(1);
      pageNumbers.push('...');
      pageNumbers.push(leftSiblingIndex);
      pageNumbers.push(currentPage);
      pageNumbers.push(rightSiblingIndex);
      pageNumbers.push('...');
      pageNumbers.push(totalPages);
    }
  }
  
  elements.pageNumbers.innerHTML = pageNumbers.map(num => 
    num === '...' 
      ? '<span class="page-dots">...</span>'
      : `<button class="${currentPage === num ? 'active' : ''}" 
          onclick="changePage(${num})">${num}</button>`
  ).join('');
}

// Pagination
function changePage(page) {
  currentPage = page;
  updateTable();
}

// Export Functions
function exportToCSV() {
  const headers = ['ID', 'NOMBRE', 'EQUIPE', 'RHHH', 'DATE', 'FINCA', 'Face', 'S CONTRAT', 'CONTRAT'];
  const csvContent = [
    headers.join(','),
    ...filteredData.map(entry => [
      entry.id,
      entry.employee,
      entry.team || '',
      entry.hours,
      entry.date,
      entry.finca || '',
      entry.face || '',
      entry.status || '',
      entry.company || ''
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `EXTRAIT-${formatDate(new Date())}.csv`;
  link.click();
}

function openPrintView() {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Rapport sur les heures de travail</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; }
        h1 { color: #2563EB; margin-bottom: 1rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th { background-color: #F3F4F6; text-align: left; padding: 0.75rem; }
        td { padding: 0.75rem; border-bottom: 1px solid #E5E7EB; }
        tr:nth-child(even) { background-color: #F9FAFB; }
        .overtime { background-color: #FEE2E2; }
        .info { margin-bottom: 1rem; color: #6B7280; }
        @media print {
          body { margin: 0.5cm; }
          h1 { font-size: 14pt; }
          table, th, td { font-size: 10pt; }
        }
      </style>
    </head>
    <body>
      <h1>Rapport sur les heures de travail</h1>
      <div class="info">
        <p>Generated: ${formatDate(new Date())}</p>
        <p>Total Entries: ${filteredData.length}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>NOMBRE</th>
            <th>EQUIPE	</th>
            <th>RHHH</th>
            <th>DATE</th>
            <th>FINCA</th>
            <th>Face</th>
            <th>S CONTRAT</th>
            <th>CONTAT</th>
          </tr>
        </thead>
        <tbody>
          ${filteredData.map(entry => `
            <tr class="${entry.hours > 8 ? 'overtime' : ''}">
              <td>${entry.id}</td>
              <td>${entry.employee}</td>
              <td>${entry.team || '-'}</td>
              <td>${entry.hours}</td>
              <td>${formatDate(entry.date)}</td>
              <td>${entry.finca || '-'}</td>
              <td>${entry.face || '-'}</td>
              <td>${entry.status || '-'}</td>
              <td>${entry.company || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  printWindow.document.open();
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  printWindow.addEventListener('load', () => {
    printWindow.print();
  });
}

// Utility Functions
function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  
  if (isNaN(date.getTime())) {
    return 'Date invalide';
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
}

function setLoading(isLoading) {
  loading = isLoading;
  elements.loadingSpinner.classList.toggle('hidden', !isLoading);
  elements.workHoursTable.classList.toggle('hidden', isLoading);
}

function setError(errorMessage) {
  error = errorMessage;
  elements.errorMessage.classList.toggle('hidden', !errorMessage);
  if (errorMessage) {
    elements.errorText.textContent = errorMessage;
  }
}



fincaFilter.addEventListener('change', function(event) {
  const selectedFinca = fincaFilter.value;


  if (selectedFinca === " ") return;

  const password = prompt("Veuillez entrer le mot de passe pour accéder à cette Finca:");

  const fincaPasswords = {
    "FINCA 1": "jid2024",
    "FINCA 2": "h123",
    "FINCA 3": "a456",
    "FINCA 4": "Ar789",
    "FINCA 5": "Fs2024",
    "FINCA 6": "Ta159",
    "FINCA 8": "Ba12",
    "FINCA 9": "664248965",
    "FINCA 13": "Ee13",
    "FINCA 19": "Tl90",
    "FINCA 20": "F20",
    "FINCA 21": "Se56",
    "FINCA 22": "twt2024"
  };
  

  // Vérifier
  if (password === fincaPasswords[selectedFinca]) {
    console.log("Mot de passe correct. Filtrage de : " + selectedFinca);
    
  } else {
    alert("Mot de passe incorrect !");
    fincaFilter.value = "";
    updateExportButtonVisibility();
  }
});

// Initialize the application
init();
