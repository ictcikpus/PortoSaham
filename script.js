// =======================================================
// SYSTEM FRONTEND CONTROLLER: script.js
// =======================================================

const API_URL = "https://script.google.com/macros/s/AKfycbzv8DyVt1Iv9BLmG1C01tpbScJy_iYmIblFFS1wh5RGfzkGQakOuLGdjhBN9U-LziY4Ow/exec";

let rawData = [];
let currentFilter = 'ALL';
let sortColumn = null;
let sortAscending = true;

// Utility Formatting
function formatRp(num) {
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

// 1. Instant Cache Loading (0 Detik)
function loadFromCache() {
  const cached = localStorage.getItem('dividen_pro_cache');
  if (cached) {
    try {
      rawData = JSON.parse(cached);
      renderTable();
    } catch (e) {}
  }
}

// 2. Fetch API dari Server
async function fetchData() {
  const loader = document.getElementById('loader');
  const syncSpinner = document.getElementById('syncSpinner');
  const syncText = document.getElementById('syncText');

  if (loader) loader.classList.remove('hidden');
  if (syncSpinner) syncSpinner.classList.remove('hidden');
  if (syncText) syncText.innerText = "Syncing...";
  
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('HTTP Status: ' + res.status);
    
    rawData = await res.json();
    localStorage.setItem('dividen_pro_cache', JSON.stringify(rawData));
    
    renderTable();
    showToast('Data berhasil diperbarui dari server', 'success');
  } catch (err) {
    console.error('API Error:', err);
    if (rawData.length === 0) {
      showToast('Gagal memuat data server', 'error');
    }
  } finally {
    if (loader) loader.classList.add('hidden');
    if (syncSpinner) syncSpinner.classList.add('hidden');
    if (syncText) syncText.innerText = "🔄 Sync Data";
  }
}

// 3. Render Data Table & KPI
function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  
  let dataToRender = [...rawData];

  // Filtering by Search Input
  const searchVal = document.getElementById('searchInput')?.value.toLowerCase() || '';
  if (searchVal) {
    dataToRender = dataToRender.filter(item => 
      item.kode.toLowerCase().includes(searchVal) || 
      item.nama.toLowerCase().includes(searchVal)
    );
  }

  // Filtering by Signal Tab
  if (currentFilter !== 'ALL') {
    dataToRender = dataToRender.filter(item => item.signal.includes(currentFilter));
  }

  // Sorting
  if (sortColumn) {
    dataToRender.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];
      if (typeof valA === 'string') {
        return sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAscending ? valA - valB : valB - valA;
    });
  }

  // Render HTML Table
  tbody.innerHTML = '';
  let totalMkt = 0, totalCost = 0, totalDiv = 0;

  dataToRender.forEach(item => {
    totalMkt += item.nilaiPasar;
    totalCost += item.modal;
    totalDiv += item.divTahun;

    const glColor = item.gainLoss >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold';
    const glPrefix = item.gainLoss >= 0 ? '+' : '';

    tbody.innerHTML += `
      <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/40">
        <td class="py-3.5 px-4">
          <div class="font-bold text-white">${item.kode}</div>
          <div class="text-[11px] text-slate-400">${item.nama}</div>
        </td>
        <td class="py-3.5 px-4 font-medium">${item.lot}</td>
        <td class="py-3.5 px-4">${formatRp(item.avgBeli)}</td>
        <td class="py-3.5 px-4 font-semibold text-white">${formatRp(item.hargaSkrg)}</td>
        <td class="py-3.5 px-4 ${glColor}">${glPrefix}${item.gainLoss}%</td>
        <td class="py-3.5 px-4 font-medium">${item.yieldPct}%</td>
        <td class="py-3.5 px-4">
          <span class="text-[11px] font-bold px-2.5 py-1 rounded-full ${item.signalClass}">
            ${item.signal}
          </span>
        </td>
        <td class="py-3.5 px-4 text-center">
          <button onclick="openModal(${item.rowIdx})" class="text-xs bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition">
            ✏️ Edit
          </button>
        </td>
      </tr>
    `;
  });

  // Calculate & Render Overall KPIs
  const totalReturn = totalCost > 0 ? ((totalMkt - totalCost) / totalCost) * 100 : 0;
  const monthlySalary = (totalDiv * 0.8) / 12;

  if (document.getElementById('totalMkt')) document.getElementById('totalMkt').innerText = formatRp(totalMkt);
  if (document.getElementById('totalReturn')) document.getElementById('totalReturn').innerText = (totalReturn >= 0 ? '+' : '') + totalReturn.toFixed(2) + '%';
  if (document.getElementById('totalDiv')) document.getElementById('totalDiv').innerText = formatRp(totalDiv);
  if (document.getElementById('monthlySalary')) document.getElementById('monthlySalary').innerText = formatRp(monthlySalary);
}

// Search & Filter Actions
function handleSearch() {
  renderTable();
}

function setFilter(filterType) {
  currentFilter = filterType;
  document.querySelectorAll('.filter-tab').forEach(btn => btn.classList.remove('active-tab'));
  
  const activeBtnMap = { 'ALL': 'tabALL', 'TAKE PROFIT': 'tabTP', 'BUY ON DIP': 'tabDIP', 'SIAP BELI': 'tabBUY', 'HOLD': 'tabHOLD' };
  if (activeBtnMap[filterType]) {
    document.getElementById(activeBtnMap[filterType])?.classList.add('active-tab');
  }
  renderTable();
}

function sortData(column) {
  if (sortColumn === column) {
    sortAscending = !sortAscending;
  } else {
    sortColumn = column;
    sortAscending = true;
  }
  renderTable();
}

// Modal & Live Preview logic
function openModal(rowIdx) {
  const item = rawData.find(d => d.rowIdx === rowIdx);
  if (!item) return;

  document.getElementById('editRowIdx').value = item.rowIdx;
  document.getElementById('modalTitle').innerText = 'Update Data ' + item.kode;
  document.getElementById('editLot').value = item.lot;
  document.getElementById('editAvg').value = item.avgBeli;
  document.getElementById('editHarga').value = item.hargaSkrg;
  document.getElementById('editDPS').value = item.dps;
  
  liveCalculateModal();
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function liveCalculateModal() {
  const lot = Number(document.getElementById('editLot').value) || 0;
  const avg = Number(document.getElementById('editAvg').value) || 0;
  const harga = Number(document.getElementById('editHarga').value) || 0;
  const dps = Number(document.getElementById('editDPS').value) || 0;

  const yieldPct = harga > 0 ? ((dps / harga) * 100).toFixed(2) : 0;
  const glPct = avg > 0 ? (((harga - avg) / avg) * 100).toFixed(2) : 0;
  const totalDiv = lot * 100 * dps;

  document.getElementById('previewYield').innerText = yieldPct + '%';
  document.getElementById('previewGL').innerText = (glPct >= 0 ? '+' : '') + glPct + '%';
  document.getElementById('previewDiv').innerText = formatRp(totalDiv);
}

async function saveData(e) {
  e.preventDefault();
  const btnSave = document.getElementById('btnSave');
  btnSave.innerText = 'Menyimpan...';
  btnSave.disabled = true;

  const payload = {
    rowIdx: Number(document.getElementById('editRowIdx').value),
    lot: Number(document.getElementById('editLot').value),
    avgBeli: Number(document.getElementById('editAvg').value),
    hargaSkrg: Number(document.getElementById('editHarga').value),
    dps: Number(document.getElementById('editDPS').value)
  };

  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast('Perubahan berhasil disimpan!', 'success');
    closeModal();
    await fetchData();
  } catch (err) {
    showToast('Gagal menyimpan perubahan', 'error');
  } finally {
    btnSave.innerText = 'Simpan Perubahan';
    btnSave.disabled = false;
  }
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-900/90 border-emerald-700 text-emerald-200' : 'bg-rose-900/90 border-rose-700 text-rose-200';
  
  toast.className = `px-4 py-3 rounded-xl border backdrop-blur-md text-xs font-semibold shadow-xl toast-enter flex items-center gap-2 ${bgClass}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// App Initialization
window.onload = function() {
  loadFromCache();
  fetchData();
};
