// =================================================================
// CORE APPLICATION ENGINE: script.js (FUNDAMENTAL SWING + DIVIDEND)
// =================================================================

const API_URL = "https://script.google.com/macros/s/AKfycbzv8DyVt1Iv9BLmG1C01tpbScJy_iYmIblFFS1wh5RGfzkGQakOuLGdjhBN9U-LziY4Ow/exec";

let rawData = [];
let currentFilter = 'ALL';
let currentMode = 'DIVIDEND'; // 'DIVIDEND' or 'SWING'
let sortColumn = null;
let sortAscending = true;
let barChartInstance = null;
let donutChartInstance = null;

const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Fundamental Data Reference Dictionary (4 Pillars)
const fundamentalDB = {
  "BSSR": { score: 95, pe: 5.9, der: 0.1, roe: 34.4, npm: 19.4, yield: 17.0, fairVal: 5800 },
  "ITMG": { score: 92, pe: 6.5, der: 0.2, roe: 22.5, npm: 18.2, yield: 9.9,  fairVal: 29500 },
  "HEXA": { score: 90, pe: 6.8, der: 0.4, roe: 27.1, npm: 15.0, yield: 11.2, fairVal: 5200 },
  "ADRO": { score: 88, pe: 5.8, der: 0.3, roe: 22.0, npm: 19.5, yield: 10.2, fairVal: 3100 },
  "PTBA": { score: 86, pe: 6.7, der: 0.4, roe: 21.8, npm: 16.2, yield: 10.5, fairVal: 3300 },
  "SMSM": { score: 89, pe: 10.2,der: 0.2, roe: 28.5, npm: 16.8, yield: 7.1,  fairVal: 2100 },
  "POWR": { score: 85, pe: 7.8, der: 0.5, roe: 15.2, npm: 14.5, yield: 8.5,  fairVal: 1150 },
  "SIDO": { score: 87, pe: 16.0,der: 0.1, roe: 29.0, npm: 28.0, yield: 6.8,  fairVal: 420 },
  "AUTO": { score: 84, pe: 6.5, der: 0.3, roe: 15.0, npm: 9.8,  yield: 7.5,  fairVal: 3800 },
  "TLKM": { score: 82, pe: 11.5,der: 0.7, roe: 18.2, npm: 17.1, yield: 6.3,  fairVal: 3300 },
  "ASII": { score: 83, pe: 6.8, der: 0.9, roe: 14.8, npm: 10.2, yield: 6.8,  fairVal: 5600 },
  "PGAS": { score: 81, pe: 7.2, der: 0.8, roe: 14.5, npm: 11.0, yield: 8.1,  fairVal: 1750 },
  "ANTM": { score: 75, pe: 14.2,der: 0.5, roe: 13.1, npm: 8.5,  yield: 3.8,  fairVal: 3500 },
  "MPMX": { score: 85, pe: 7.5, der: 0.4, roe: 15.1, npm: 12.0, yield: 9.2,  fairVal: 1200 },
  "PBID": { score: 84, pe: 8.1, der: 0.2, roe: 16.5, npm: 9.5,  yield: 8.1,  fairVal: 650 },
  "DMAS": { score: 86, pe: 8.5, der: 0.1, roe: 17.0, npm: 45.0, yield: 9.5,  fairVal: 220 }
};

function getSavedPin() {
  return sessionStorage.getItem('dividen_pro_pin') || '';
}

function formatRp(num) {
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

// Authentication
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
    showToast('PIN Salah! Periksa Apps Script.', 'error');
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

// Data Fetcher
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

    rawData = processSignals(result);
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

// Process Fundamental & Swing Signals
function processSignals(data) {
  return data.map(item => {
    const fData = fundamentalDB[item.kode] || { score: 75, fairVal: item.hargaSkrg * 1.15 };
    const mos = ((fData.fairVal - item.hargaSkrg) / fData.fairVal) * 100;
    
    let signal = "HOLD";
    let signalClass = "bg-blue-900/40 text-blue-300 border border-blue-700/50";

    if (item.gainLoss >= 15 && item.lot > 0) {
      signal = "TAKE PROFIT";
      signalClass = "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50";
    } else if (mos >= 15 && fData.score >= 80) {
      signal = "STRONG BUY";
      signalClass = "bg-purple-900/40 text-purple-300 border border-purple-700/50 animate-pulse";
    } else if (item.gainLoss <= -5 && item.lot > 0) {
      signal = "BUY ON DIP";
      signalClass = "bg-rose-900/40 text-rose-300 border border-rose-700/50";
    }

    return {
      ...item,
      score: fData.score,
      fairVal: fData.fairVal,
      mos: Number(mos.toFixed(1)),
      signal: signal,
      signalClass: signalClass
    };
  });
}

// Switch View Modes (Dividen vs Swing Trading)
function switchViewMode(mode) {
  currentMode = mode;
  document.getElementById('btnModeDiv').classList.toggle('active-mode', mode === 'DIVIDEND');
  document.getElementById('btnModeDiv').classList.toggle('text-slate-400', mode !== 'DIVIDEND');
  document.getElementById('btnModeSwing').classList.toggle('active-mode', mode === 'SWING');
  document.getElementById('btnModeSwing').classList.toggle('text-slate-400', mode !== 'SWING');
  
  document.getElementById('tableTitle').innerText = mode === 'DIVIDEND' 
    ? 'Matriks Dividen & Arus Kas Multi-Broker' 
    : 'Matriks Fundamental & Target Swing Trading';

  renderTable();
}

// Render Table Header & Rows
function renderTable() {
  const thead = document.getElementById('tableHeader');
  const tbody = document.getElementById('tableBody');
  if (!tbody || !thead) return;

  // Header Construction based on Mode
  if (currentMode === 'DIVIDEND') {
    thead.innerHTML = `
      <tr class="sticky-header bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800/80 text-[10px] tracking-wider">
        <th class="py-3.5 px-3.5 sticky-col cursor-pointer hover:text-white" onclick="sortData('kode')">Emiten ⇕</th>
        <th class="py-3.5 px-3.5 cursor-pointer hover:text-white" onclick="sortData('lot')">Total Lot ⇕</th>
        <th class="py-3.5 px-3.5 cursor-pointer hover:text-white" onclick="sortData('avgBeli')">Avg Gabungan ⇕</th>
        <th class="py-3.5 px-3.5 cursor-pointer hover:text-white" onclick="sortData('hargaSkrg')">Harga Skrg ⇕</th>
        <th class="py-3.5 px-3.5 cursor-pointer hover:text-white" onclick="sortData('gainLoss')">Gain/Loss ⇕</th>
        <th class="py-3.5 px-3.5 cursor-pointer hover:text-white" onclick="sortData('yieldPct')">Yield (%) ⇕</th>
        <th class="py-3.5 px-3.5">Rincian Sekuritas</th>
        <th class="py-3.5 px-3.5">Bulan Div</th>
        <th class="py-3.5 px-3.5">Sinyal Aksi</th>
        <th class="py-3.5 px-3.5 text-center">Aksi</th>
      </tr>
    `;
  } else {
    thead.innerHTML = `
      <tr class="sticky-header bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800/80 text-[10px] tracking-wider">
        <th class="py-3.5 px-3.5 sticky-col cursor-pointer hover:text-white" onclick="sortData('kode')">Emiten ⇕</th>
        <th class="py-3.5 px-3.5 cursor-pointer hover:text-white" onclick="sortData('score')">Skor Fundamental ⇕</th>
        <th class="py-3.5 px-3.5 cursor-pointer hover:text-white" onclick="sortData('hargaSkrg')">Harga Skrg ⇕</th>
        <th class="py-3.5 px-3.5 cursor-pointer hover:text-white" onclick="sortData('fairVal')">Nilai Wajar ⇕</th>
        <th class="py-3.5 px-3.5 cursor-pointer hover:text-white" onclick="sortData('mos')">Margin of Safety ⇕</th>
        <th class="py-3.5 px-3.5">Status Swing Zone</th>
        <th class="py-3.5 px-3.5 text-center">Skor Fundamental</th>
        <th class="py-3.5 px-3.5 text-center">Aksi</th>
      </tr>
    `;
  }

  let dataToRender = [...rawData];

  // Filtering
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

  // Sorting
  if (sortColumn) {
    dataToRender.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];
      return sortAscending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }

  tbody.innerHTML = '';
  let totalMkt = 0, totalCost = 0, totalDiv = 0, weightedScoreSum = 0;

  dataToRender.forEach(item => {
    totalMkt += item.nilaiPasar;
    totalCost += item.modal;
    totalDiv += item.divTahun;
    weightedScoreSum += item.score * (item.nilaiPasar || 1);

    const glColor = item.gainLoss >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold';
    const glPrefix = item.gainLoss >= 0 ? '+' : '';

    if (currentMode === 'DIVIDEND') {
      let brokerBadges = '';
      if (item.lotIPOT > 0) brokerBadges += `<span class="text-[9px] bg-blue-900/50 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded mr-1">IPOT: ${item.lotIPOT}</span>`;
      if (item.lotHOTS > 0) brokerBadges += `<span class="text-[9px] bg-amber-900/50 text-amber-300 border border-amber-700/50 px-1.5 py-0.5 rounded mr-1">HOTS: ${item.lotHOTS}</span>`;
      if (item.lotSB > 0)   brokerBadges += `<span class="text-[9px] bg-emerald-900/50 text-emerald-300 border border-emerald-700/50 px-1.5 py-0.5 rounded">SB: ${item.lotSB}</span>`;
      if (!brokerBadges) brokerBadges = '<span class="text-slate-500 text-[10px]">-</span>';

      tbody.innerHTML += `
        <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/40">
          <td class="py-3 px-3.5 sticky-col">
            <div class="font-bold text-white flex items-center gap-1.5">
              ${item.kode}
              <button onclick="openScorecardModal('${item.kode}')" title="Cek Fundamental Scorecard" class="text-[10px] text-purple-400 hover:text-purple-300">📊</button>
            </div>
            <div class="text-[10px] text-slate-400 max-w-[110px] truncate">${item.nama}</div>
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
    } else {
      // Swing Mode Rows
      const mosColor = item.mos >= 15 ? 'text-purple-400 font-bold' : (item.mos >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400');
      tbody.innerHTML += `
        <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/40">
          <td class="py-3 px-3.5 sticky-col">
            <div class="font-bold text-white">${item.kode}</div>
            <div class="text-[10px] text-slate-400 max-w-[110px] truncate">${item.nama}</div>
          </td>
          <td class="py-3 px-3.5 font-bold text-purple-300">${item.score} / 100</td>
          <td class="py-3 px-3.5 font-semibold text-white">${formatRp(item.hargaSkrg)}</td>
          <td class="py-3 px-3.5 font-medium text-blue-400">${formatRp(item.fairVal)}</td>
          <td class="py-3 px-3.5 ${mosColor}">${item.mos > 0 ? '+' : ''}${item.mos}%</td>
          <td class="py-3 px-3.5">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${item.signalClass}">
              ${item.signal}
            </span>
          </td>
          <td class="py-3 px-3.5 text-center">
            <button onclick="openScorecardModal('${item.kode}')" class="text-[10px] bg-purple-950/60 hover:bg-purple-900 border border-purple-700/60 text-purple-300 px-2.5 py-1 rounded-lg transition">
              🔍 Skor Detail
            </button>
          </td>
          <td class="py-3 px-3.5 text-center">
            <button onclick="openModal(${item.rowIdx})" class="text-[11px] bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 transition">
              ✏️ Edit
            </button>
          </td>
        </tr>
      `;
    }
  });

  // Top KPIs Update
  const totalReturn = totalCost > 0 ? ((totalMkt - totalCost) / totalCost) * 100 : 0;
  const monthlySalary = (totalDiv * 0.9) / 12; // 10% tax deduction
  const avgYield = totalMkt > 0 ? (totalDiv / totalMkt) * 100 : 0;
  const avgScore = totalMkt > 0 ? (weightedScoreSum / totalMkt) : 85;

  if (document.getElementById('totalMkt')) document.getElementById('totalMkt').innerText = formatRp(totalMkt);
  if (document.getElementById('totalReturn')) document.getElementById('totalReturn').innerText = (totalReturn >= 0 ? '+' : '') + totalReturn.toFixed(2) + '%';
  if (document.getElementById('totalDiv')) document.getElementById('totalDiv').innerText = formatRp(totalDiv);
  if (document.getElementById('avgYield')) document.getElementById('avgYield').innerText = 'Avg Yield: ' + avgYield.toFixed(2) + '%';
  if (document.getElementById('monthlySalary')) document.getElementById('monthlySalary').innerText = formatRp(monthlySalary);
  if (document.getElementById('portfolioScore')) document.getElementById('portfolioScore').innerText = Math.round(avgScore) + ' / 100';
}

function handleSearch() { renderTable(); }
function setFilter(type) {
  currentFilter = type;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active-tab'));
  const map = { 'ALL': 'tabALL', 'STRONG BUY': 'tabBUY', 'TAKE PROFIT': 'tabTP', 'BUY ON DIP': 'tabDIP', 'HOLD': 'tabHOLD' };
  if (map[type]) document.getElementById(map[type])?.classList.add('active-tab');
  renderTable();
}
function sortData(col) {
  sortAscending = sortColumn === col ? !sortAscending : true;
  sortColumn = col;
  renderTable();
}

// Fundamental Scorecard Modal Popup
function openScorecardModal(ticker) {
  const fData = fundamentalDB[ticker] || { score: 75, pe: 10, der: 0.5, roe: 15, npm: 10, yield: 6.0, fairVal: 1000 };
  const item = rawData.find(d => d.kode === ticker) || { hargaSkrg: fData.fairVal * 0.85 };
  
  document.getElementById('scTicker').innerText = ticker;
  document.getElementById('scName').innerText = item.nama || ticker;
  document.getElementById('scScoreBadge').innerText = fData.score;
  
  document.getElementById('scValuationVal').innerText = `PE ${fData.pe}x`;
  document.getElementById('scSolvencyVal').innerText = `DER ${fData.der}x`;
  document.getElementById('scProfitVal').innerText = `ROE ${fData.roe}%`;
  document.getElementById('scDividendVal').innerText = `Yield ${fData.yield}%`;

  document.getElementById('scorecardModal').classList.remove('hidden');
}

function closeScorecardModal() {
  document.getElementById('scorecardModal').classList.add('hidden');
}

// Interactive Charts Engine
function renderInteractiveCharts() {
  let monthlyAmounts = new Array(12).fill(0);

  rawData.forEach(item => {
    if (item.lot > 0 && item.divTahun > 0 && item.bulanDiv) {
      const months = item.bulanDiv.split(',')
        .map(m => parseInt(m.trim()))
        .filter(m => m >= 1 && m <= 12);
      
      if (months.length > 0) {
        const amountPerPayout = item.divTahun / months.length;
        months.forEach(m => monthlyAmounts[m - 1] += amountPerPayout);
      }
    }
  });

  const ctxBar = document.getElementById('dividendChart')?.getContext('2d');
  if (ctxBar) {
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: monthNames,
        datasets: [{
          label: 'Estimasi Dividen (Rp)',
          data: monthlyAmounts,
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          borderColor: '#3b82f6',
          borderWidth: 1.5,
          borderRadius: 8
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

  const activeDividendStocks = rawData.filter(d => d.lot > 0);
  const ctxDonut = document.getElementById('shareChart')?.getContext('2d');
  if (ctxDonut) {
    if (donutChartInstance) donutChartInstance.destroy();
    donutChartInstance = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: activeDividendStocks.map(s => s.kode),
        datasets: [{
          data: activeDividendStocks.map(s => s.nilaiPasar),
          backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#6366f1', '#14b8a6'],
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

// Edit Modal Functions
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

    showToast('Data berhasil disimpan!', 'success');
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
  toast.className = `px-4 py-3 rounded-2xl border backdrop-blur-md text-xs font-semibold shadow-xl toast-enter flex items-center gap-2 pointer-events-auto ${bgClass}`;
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
