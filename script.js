// =======================================================
// CONTROLLER: script.js (WITH CHART.JS & MONTHLY SCHEDULE)
// =======================================================

const API_URL = "https://script.google.com/macros/s/AKfycbzv8DyVt1Iv9BLmG1C01tpbScJy_iYmIblFFS1wh5RGfzkGQakOuLGdjhBN9U-LziY4Ow/exec";

let rawData = [];
let currentFilter = 'ALL';
let sortColumn = null;
let sortAscending = true;
let chartInstance = null;

const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function getSavedPin() {
  return sessionStorage.getItem('dividen_pro_pin') || '';
}

function formatRp(num) {
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

// Login & Auth
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
    renderChartAndSchedule();
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

// Render Monthly Chart & Matrix Schedule
function renderChartAndSchedule() {
  let monthlyAmounts = new Array(12).fill(0);
  let monthlyEmitens = Array.from({ length: 12 }, () => []);

  rawData.forEach(item => {
    if (item.lot > 0 && item.divTahun > 0 && item.bulanDiv) {
      const months = item.bulanDiv.split(',')
        .map(m => parseInt(m.trim()))
        .filter(m => m >= 1 && m <= 12);
      
      if (months.length > 0) {
        const amountPerPayout = item.divTahun / months.length;
        months.forEach(m => {
          monthlyAmounts[m - 1] += amountPerPayout;
          monthlyEmitens[m - 1].push(item.kode);
        });
      }
    }
  });

  // 1. Render Bar Chart
  const ctx = document.getElementById('dividendChart')?.getContext('2d');
  if (ctx) {
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthNames,
        datasets: [{
          label: 'Estimasi Dividen (Rp)',
          data: monthlyAmounts,
          backgroundColor: 'rgba(16, 185, 129, 0.65)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 6,
          hoverBackgroundColor: 'rgba(16, 185, 129, 0.9)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => 'Dividen: ' + formatRp(context.raw)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(30, 41, 59, 0.5)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: (val) => 'Rp ' + (val / 1000000).toFixed(1) + ' Jt'
            }
          }
        }
      }
    });
  }

  // 2. Render Matrix Jadwal Dividen Grid
  const scheduleGrid = document.getElementById('monthlyScheduleGrid');
  if (scheduleGrid) {
    scheduleGrid.innerHTML = '';
    monthNames.forEach((month, idx) => {
      const amount = monthlyAmounts[idx];
      const emitens = monthlyEmitens[idx];
      const hasDiv = amount > 0;

      scheduleGrid.innerHTML += `
        <div class="p-2.5 rounded-xl border ${hasDiv ? 'bg-slate-800/80 border-emerald-500/40' : 'bg-slate-950/40 border-slate-800/60'} transition">
          <div class="flex justify-between items-center mb-1">
            <span class="font-bold text-xs ${hasDiv ? 'text-emerald-400' : 'text-slate-500'}">${month}</span>
            <span class="text-[9px] font-semibold text-slate-400">${hasDiv ? formatRp(amount) : '-'}</span>
          </div>
          <div class="text-[9px] text-slate-300 truncate font-mono">
            ${emitens.length > 0 ? emitens.join(', ') : '<span class="text-slate-600">Sepi</span>'}
          </div>
        </div>
      `;
    });
  }
}

// Render Data Table & KPI
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

// Modal Edit
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

// Toast
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
