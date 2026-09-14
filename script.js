// =======================================================
// CONTROLLER: script.js (AUTOMATIC WEIGHTED AVERAGE MULTI-BROKER)
// =======================================================

const API_URL = "https://script.google.com/macros/s/AKfycbzv8DyVt1Iv9BLmG1C01tpbScJy_iYmIblFFS1wh5RGfzkGQakOuLGdjhBN9U-LziY4Ow/exec";

let rawData = [];
let currentFilter = 'ALL';
let sortColumn = null;
let sortAscending = true;
let barChartInstance = null;
let donutChartInstance = null;

const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function getSavedPin() {
  return sessionStorage.getItem('dividen_pro_pin') || '';
}

function formatRp(num) {
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

// Auth Handlers
async function handleLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('pinInput').value.trim();
  const btnLogin = document.getElementById('btnLogin');
  
  btnLogin.innerText = "Memverifikasi...";
  btnLogin.disabled = true;

  sessionStorage.setItem('dividen_pro_pin', pin);

  const success = await fetchData();
  if (success) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    showToast('Login berhasil', 'success');
  } else {
    sessionStorage.removeItem('dividen_pro_pin');
    showToast('PIN Salah! Pastikan Apps Script di-deploy Versi Baru.', 'error');
  }

  btnLogin.innerText = "Buka Dashboard";
  btnLogin.disabled = false;
}

function handleLogout() {
  sessionStorage.removeItem('dividen_pro_pin');
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('pinInput').value = '';
  showToast('Sesi telah berakhir', 'info');
}

// Fetch API
async function fetchData() {
  const pin = getSavedPin();
  if (!pin) return false;

  const loader = document.getElementById('loader');
  const syncSpinner = document.getElementById('syncSpinner');
  const syncText = document.getElementById('syncText');

  if (loader) loader.classList.remove('hidden');
  if (syncSpinner) syncSpinner.classList.remove('hidden');
  if (syncText) syncText.innerText = "Syncing...";

  try {
    const res = await fetch(`${API_URL}?pin=${encodeURIComponent(pin)}`);
    if (!res.ok) throw new Error('HTTP Error ' + res.status);
    
    const result = await res.json();
    if (result.status === "unauthorized") return false;

    rawData = result;
    renderTable();
    renderInteractiveCharts();
    return true;
  } catch (err) {
    console.error('API Error:', err);
    return false;
  } finally {
    if (loader) loader.classList.add('hidden');
    if (syncSpinner) syncSpinner.classList.add('hidden');
    if (syncText) syncText.innerText = "Sync Data";
  }
}

// Interactive Charts
function renderInteractiveCharts() {
  let monthlyAmounts = new Array(12).fill(0);
  let monthlyEmitens = Array.from({ length: 12 }, () => []);

  const activeDividendStocks = rawData.filter(d => d.lot > 0 && d.divTahun > 0);
  const totalDivAll = activeDividendStocks.reduce((sum, item) => sum + item.divTahun, 0);

  rawData.forEach(item => {
    if (item.lot > 0 && item.divTahun > 0 && item.bulanDiv) {
      const months = item.bulanDiv.split(',')
        .map(m => parseInt(m.trim()))
        .filter(m => m >= 1 && m <= 12);
      
      if (months.length > 0) {
        const amountPerPayout = item.divTahun / months.length;
        months.forEach(m => {
          monthlyAmounts[m - 1] += amountPerPayout;
          monthlyEmitens[m - 1].push({ kode: item.kode, amount: amountPerPayout });
        });
      }
    }
  });

  // Bar Chart
  const ctxBar = document.getElementById('dividendChart')?.getContext('2d');
  if (ctxBar) {
    if (barChartInstance) barChartInstance.destroy();

    barChartInstance = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: monthNames,
        datasets: [{
          label: 'Estimasi Dividen',
          data: monthlyAmounts,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
          y: { grid: { color: 'rgba(30, 41, 59, 0.5)' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
        }
      }
    });
  }

  // Donut Chart
  const ctxDonut = document.getElementById('shareChart')?.getContext('2d');
  if (ctxDonut) {
    if (donutChartInstance) donutChartInstance.destroy();

    donutChartInstance = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: activeDividendStocks.map(s => s.kode),
        datasets: [{
          data: activeDividendStocks.map(s => s.divTahun),
          backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#6366f1', '#14b8a6'],
          borderColor: '#0f172a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#cbd5e1', font: { size: 10 } } } },
        cutout: '68%'
      }
    });
  }
}

// Render Table
function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  
  let dataToRender = [...rawData];

  const searchVal = document.getElementById('searchInput')?.value.toLowerCase() || '';
  if (searchVal) {
    dataToRender = dataToRender.filter(item => 
      item.kode.toLowerCase().includes(searchVal) || 
      item.nama.toLowerCase().includes(searchVal)
    );
  }

  if (currentFilter !== 'ALL') {
    dataToRender = dataToRender.filter(item => item.signal.includes(currentFilter));
  }

  if (sortColumn) {
    dataToRender.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];
      return sortAscending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }

  tbody.innerHTML = '';
  let totalMkt = 0, totalCost = 0, totalDiv = 0;

  dataToRender.forEach(item => {
    totalMkt += item.nilaiPasar;
    totalCost += item.modal;
    totalDiv += item.divTahun;

    const glColor = item.gainLoss >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold';
    const glPrefix = item.gainLoss >= 0 ? '+' : '';

    // Badges Sekuritas
    let brokerBadges = '';
    if (item.lotIPOT > 0) brokerBadges += `<span class="text-[9px] bg-blue-900/50 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded mr-1">IPOT: ${item.lotIPOT}</span>`;
    if (item.lotHOTS > 0) brokerBadges += `<span class="text-[9px] bg-amber-900/50 text-amber-300 border border-amber-700/50 px-1.5 py-0.5 rounded mr-1">HOTS: ${item.lotHOTS}</span>`;
    if (item.lotSB > 0)   brokerBadges += `<span class="text-[9px] bg-emerald-900/50 text-emerald-300 border border-emerald-700/50 px-1.5 py-0.5 rounded">SB: ${item.lotSB}</span>`;
    if (!brokerBadges) brokerBadges = '<span class="text-slate-500 text-[10px]">-</span>';

    tbody.innerHTML += `
      <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/40">
        <td class="py-3 px-3.5 sticky-col">
          <div class="font-bold text-white">${item.kode}</div>
          <div class="text-[10px] text-slate-400 max-w-[100px] truncate">${item.nama}</div>
        </td>
        <td class="py-3 px-3.5 font-semibold text-white">${item.lot}</td>
        <td class="py-3 px-3.5 font-medium text-blue-400">${formatRp(item.avgBeli)}</td>
        <td class="py-3 px-3.5 font-semibold text-white">${formatRp(item.hargaSkrg)}</td>
        <td class="py-3 px-3.5 ${glColor}">${glPrefix}${item.gainLoss}%</td>
        <td class="py-3 px-3.5 font-medium text-emerald-400">${item.yieldPct}%</td>
        <td class="py-3 px-3.5">${brokerBadges}</td>
        <td class="py-3 px-3.5 text-slate-400 font-mono text-[10px]">${item.bulanDiv || '-'}</td>
        <td class="py-3 px-3.5">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${item.signalClass}">
            ${item.signal}
          </span>
        </td>
        <td class="py-3 px-3.5 text-center">
          <button onclick="openModal(${item.rowIdx})" class="text-[11px] bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 transition">
            ✏️ Edit
          </button>
        </td>
      </tr>
    `;
  });

  const totalReturn = totalCost > 0 ? ((totalMkt - totalCost) / totalCost) * 100 : 0;
  const monthlySalary = (totalDiv * 0.8) / 12;

  if (document.getElementById('totalMkt')) document.getElementById('totalMkt').innerText = formatRp(totalMkt);
  if (document.getElementById('totalReturn')) document.getElementById('totalReturn').innerText = (totalReturn >= 0 ? '+' : '') + totalReturn.toFixed(2) + '%';
  if (document.getElementById('totalDiv')) document.getElementById('totalDiv').innerText = formatRp(totalDiv);
  if (document.getElementById('monthlySalary')) document.getElementById('monthlySalary').innerText = formatRp(monthlySalary);
}

function handleSearch() { renderTable(); }
function setFilter(type) {
  currentFilter = type;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active-tab'));
  const map = { 'ALL': 'tabALL', 'TAKE PROFIT': 'tabTP', 'BUY ON DIP': 'tabDIP', 'SIAP BELI': 'tabBUY', 'HOLD': 'tabHOLD' };
  if (map[type]) document.getElementById(map[type])?.classList.add('active-tab');
  renderTable();
}
function sortData(col) {
  sortAscending = sortColumn === col ? !sortAscending : true;
  sortColumn = col;
  renderTable();
}

// Modal Live Calculation
function openModal(rowIdx) {
  const item = rawData.find(d => d.rowIdx === rowIdx);
  if (!item) return;

  document.getElementById('editRowIdx').value = item.rowIdx;
  document.getElementById('modalTitle').innerText = 'Update Multi Sekuritas ' + item.kode;
  
  document.getElementById('editLotIPOT').value = item.lotIPOT || '';
  document.getElementById('editAvgIPOT').value = item.avgIPOT || '';
  document.getElementById('editLotHOTS').value = item.lotHOTS || '';
  document.getElementById('editAvgHOTS').value = item.avgHOTS || '';
  document.getElementById('editLotSB').value   = item.lotSB || '';
  document.getElementById('editAvgSB').value   = item.avgSB || '';
  
  document.getElementById('editHarga').value = item.hargaSkrg;
  document.getElementById('editDPS').value = item.dps;
  document.getElementById('editBulanDiv').value = item.bulanDiv || '';
  
  liveCalculateModal();
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function liveCalculateModal() {
  const lotIPOT = Number(document.getElementById('editLotIPOT').value) || 0;
  const avgIPOT = Number(document.getElementById('editAvgIPOT').value) || 0;
  const lotHOTS = Number(document.getElementById('editLotHOTS').value) || 0;
  const avgHOTS = Number(document.getElementById('editAvgHOTS').value) || 0;
  const lotSB   = Number(document.getElementById('editLotSB').value) || 0;
  const avgSB   = Number(document.getElementById('editAvgSB').value) || 0;

  const harga = Number(document.getElementById('editHarga').value) || 0;
  const dps   = Number(document.getElementById('editDPS').value) || 0;

  const totalLot = lotIPOT + lotHOTS + lotSB;
  const totalModal = (lotIPOT * 100 * avgIPOT) + (lotHOTS * 100 * avgHOTS) + (lotSB * 100 * avgSB);
  const weightedAvg = totalLot > 0 ? (totalModal / (totalLot * 100)) : 0;
  
  const yocPct = weightedAvg > 0 ? ((dps / weightedAvg) * 100).toFixed(2) : 0;
  const totalDiv = totalLot * 100 * dps;

  document.getElementById('previewTotalLot').innerText = totalLot + ' Lot';
  document.getElementById('previewWeightedAvg').innerText = formatRp(weightedAvg);
  document.getElementById('previewYOC').innerText = yocPct + '%';
  document.getElementById('previewDiv').innerText = formatRp(totalDiv);
}

async function saveData(e) {
  e.preventDefault();
  const pin = getSavedPin();
  if (!pin) return;

  const btnSave = document.getElementById('btnSave');
  btnSave.innerText = 'Menyimpan...';
  btnSave.disabled = true;

  const payload = {
    pin: pin,
    rowIdx: Number(document.getElementById('editRowIdx').value),
    lotIPOT: Number(document.getElementById('editLotIPOT').value) || 0,
    avgIPOT: Number(document.getElementById('editAvgIPOT').value) || 0,
    lotHOTS: Number(document.getElementById('editLotHOTS').value) || 0,
    avgHOTS: Number(document.getElementById('editAvgHOTS').value) || 0,
    lotSB: Number(document.getElementById('editLotSB').value) || 0,
    avgSB: Number(document.getElementById('editAvgSB').value) || 0,
    hargaSkrg: Number(document.getElementById('editHarga').value) || 0,
    dps: Number(document.getElementById('editDPS').value) || 0,
    bulanDiv: document.getElementById('editBulanDiv').value.trim()
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const resJson = await res.json();
    
    if (resJson.status === "unauthorized") {
      showToast('PIN tidak valid!', 'error');
      handleLogout();
      return;
    }

    showToast('Data multi-sekuritas disimpan!', 'success');
    closeModal();
    await fetchData();
  } catch (err) {
    showToast('Gagal menyimpan perubahan', 'error');
  } finally {
    btnSave.innerText = 'Simpan Perubahan';
    btnSave.disabled = false;
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200' : 'bg-rose-950/90 border-rose-800 text-rose-200';
  toast.className = `px-3.5 py-2.5 rounded-xl border backdrop-blur-md text-xs font-semibold shadow-xl toast-enter flex items-center gap-2 pointer-events-auto ${bgClass}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

window.onload = async function() {
  const pin = getSavedPin();
  if (pin) {
    const success = await fetchData();
    if (success) {
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('mainApp').classList.remove('hidden');
    } else {
      handleLogout();
    }
  }
};
