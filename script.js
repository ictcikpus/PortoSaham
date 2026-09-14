// =======================================================
// CONTROLLER: script.js (WITH INTERACTIVE CHARTS & ALIGNMENT EVALUATION)
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
    showToast('PIN Salah! Pastikan PIN di Apps Script sudah di-deploy Versi Baru.', 'error');
  }

  btnLogin.innerText = "Buka Dashboard";
  btnLogin.disabled = false;
}

function handleLogout() {
  sessionStorage.removeItem('dividen_pro_pin');
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('pinInput').value = '';
  showToast('Sesi berakhir', 'info');
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
    
    if (result.status === "unauthorized") {
      return false;
    }

    rawData = result;
    renderTable();
    renderInteractiveCharts();
    evaluatePortfolioAlignment();
    return true;
  } catch (err) {
    console.error('API Error:', err);
    return false;
  } finally {
    if (loader) loader.classList.add('hidden');
    if (syncSpinner) syncSpinner.classList.add('hidden');
    if (syncText) syncText.innerText = "Sync";
  }
}

// 1. Render Dual Interactive Charts (Bar + Donut)
function renderInteractiveCharts() {
  let monthlyAmounts = new Array(12).fill(0);
  let monthlyEmitens = Array.from({ length: 12 }, () => []);

  // Filter emiten yang dimiliki (lot > 0) dan membagikan dividen
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

  // --- CHART 1: BAR CHART CASHFLOW BULANAN ---
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
          borderRadius: 6,
          hoverBackgroundColor: 'rgba(16, 185, 129, 0.95)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => 'Total: ' + formatRp(context.raw),
              afterBody: (tooltipItems) => {
                const monthIdx = tooltipItems[0].dataIndex;
                const emitens = monthlyEmitens[monthIdx];
                if (!emitens || emitens.length === 0) return '\nEmiten: Sepi';
                let text = '\nEmiten Pembagi:\n';
                emitens.forEach(e => {
                  text += `• ${e.kode}: ${formatRp(e.amount)}\n`;
                });
                return text;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
          y: {
            grid: { color: 'rgba(30, 41, 59, 0.5)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: (val) => 'Rp ' + (val / 1000000).toFixed(1) + 'Jt'
            }
          }
        }
      }
    });
  }

  // --- CHART 2: DONUT CHART KONTRIBUSI EMITEN ---
  const ctxDonut = document.getElementById('shareChart')?.getContext('2d');
  if (ctxDonut) {
    if (donutChartInstance) donutChartInstance.destroy();

    const donutLabels = activeDividendStocks.map(s => s.kode);
    const donutData = activeDividendStocks.map(s => s.divTahun);
    const donutColors = [
      '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
      '#06b6d4', '#6366f1', '#14b8a6', '#f43f5e', '#64748b'
    ];

    donutChartInstance = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: donutLabels,
        datasets: [{
          data: donutData,
          backgroundColor: donutColors.slice(0, donutLabels.length),
          borderColor: '#0f172a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#cbd5e1', font: { size: 10 }, boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                const pct = totalDivAll > 0 ? ((val / totalDivAll) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${formatRp(val)} (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }
}

// 2. Evaluasi Kesesuaian Portofolio vs Dividen (Portfolio Alignment)
function evaluatePortfolioAlignment() {
  const underweightList = document.getElementById('underweightList');
  const balancedList = document.getElementById('balancedList');
  const watchlistList = document.getElementById('watchlistList');

  if (!underweightList || !balancedList || !watchlistList) return;

  underweightList.innerHTML = '';
  balancedList.innerHTML = '';
  watchlistList.innerHTML = '';

  let uwCount = 0, balCount = 0, wlCount = 0;
  let totalOwnedCount = 0;
  let optimalCount = 0;

  rawData.forEach(item => {
    // Kriteria Yield Tinggi jika Yield >= 5%
    const isHighYield = item.yieldPct >= 5.0;
    const isOwned = item.lot > 0;

    if (isOwned) totalOwnedCount++;

    if (!isOwned && isHighYield) {
      // Underweight / Diskon Siap Beli
      uwCount++;
      underweightList.innerHTML += `
        <div class="flex justify-between items-center bg-slate-900/80 p-2 rounded-lg border border-purple-800/40">
          <div>
            <span class="font-bold text-white">${item.kode}</span>
            <span class="text-[10px] text-purple-300 ml-1">Yield: ${item.yieldPct}%</span>
          </div>
          <span class="text-[9px] bg-purple-900/60 text-purple-200 px-2 py-0.5 rounded font-bold">0 Lot (Siap Beli)</span>
        </div>
      `;
    } else if (isOwned && isHighYield) {
      // Balanced / Alokasi Optimal
      balCount++;
      optimalCount++;
      balancedList.innerHTML += `
        <div class="flex justify-between items-center bg-slate-900/80 p-2 rounded-lg border border-emerald-800/40">
          <div>
            <span class="font-bold text-white">${item.kode}</span>
            <span class="text-[10px] text-emerald-300 ml-1">Yield: ${item.yieldPct}%</span>
          </div>
          <span class="text-[10px] text-slate-300 font-medium">${item.lot} Lot</span>
        </div>
      `;
    } else {
      // Watchlist / Low Yield
      wlCount++;
      watchlistList.innerHTML += `
        <div class="flex justify-between items-center bg-slate-900/80 p-2 rounded-lg border border-slate-800">
          <div>
            <span class="font-bold text-slate-300">${item.kode}</span>
            <span class="text-[10px] text-slate-500 ml-1">Yield: ${item.yieldPct}%</span>
          </div>
          <span class="text-[10px] text-slate-400">${item.lot > 0 ? item.lot + ' Lot' : 'Watchlist'}</span>
        </div>
      `;
    }
  });

  document.getElementById('underweightCount').innerText = uwCount;
  document.getElementById('balancedCount').innerText = balCount;
  document.getElementById('watchlistCount').innerText = wlCount;

  // Calculate Alignment Score
  const score = totalOwnedCount > 0 ? Math.round((optimalCount / totalOwnedCount) * 100) : 0;
  const badge = document.getElementById('alignmentScoreBadge');
  if (badge) {
    badge.innerText = `Skor Optimalisasi Dividen: ${score}%`;
    if (score >= 70) {
      badge.className = "text-xs font-bold px-3 py-1 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700/50";
    } else {
      badge.className = "text-xs font-bold px-3 py-1 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/50";
    }
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
      if (typeof valA === 'string') {
        return sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAscending ? valA - valB : valB - valA;
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

    tbody.innerHTML += `
      <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/40">
        <td class="py-3 px-3.5">
          <div class="font-bold text-white">${item.kode}</div>
          <div class="text-[10px] text-slate-400 max-w-[110px] truncate">${item.nama}</div>
        </td>
        <td class="py-3 px-3.5 font-medium">${item.lot}</td>
        <td class="py-3 px-3.5">${formatRp(item.avgBeli)}</td>
        <td class="py-3 px-3.5 font-semibold text-white">${formatRp(item.hargaSkrg)}</td>
        <td class="py-3 px-3.5 ${glColor}">${glPrefix}${item.gainLoss}%</td>
        <td class="py-3 px-3.5 font-medium">${item.yieldPct}%</td>
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

// Modal Handlers
function openModal(rowIdx) {
  const item = rawData.find(d => d.rowIdx === rowIdx);
  if (!item) return;

  document.getElementById('editRowIdx').value = item.rowIdx;
  document.getElementById('modalTitle').innerText = 'Update ' + item.kode;
  document.getElementById('editLot').value = item.lot;
  document.getElementById('editAvg').value = item.avgBeli;
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
  const pin = getSavedPin();
  if (!pin) return;

  const btnSave = document.getElementById('btnSave');
  btnSave.innerText = 'Menyimpan...';
  btnSave.disabled = true;

  const payload = {
    pin: pin,
    rowIdx: Number(document.getElementById('editRowIdx').value),
    lot: Number(document.getElementById('editLot').value),
    avgBeli: Number(document.getElementById('editAvg').value),
    hargaSkrg: Number(document.getElementById('editHarga').value),
    dps: Number(document.getElementById('editDPS').value),
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

    showToast('Data berhasil diperbarui!', 'success');
    closeModal();
    await fetchData();
  } catch (err) {
    showToast('Gagal menyimpan perubahan', 'error');
  } finally {
    btnSave.innerText = 'Simpan';
    btnSave.disabled = false;
  }
}

// Toast System
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

// Init
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
