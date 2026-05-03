// ── evcalc.js v1.4 ────────────────────────────────────────
const BMS_UMBRAL_POT = 22;
const BMS_LIMITE_SOC = 80;
const BMS_POT_MAX    = 11;
const CONSUMOS       = [13, 14, 15]; // kWh/100km

// ── Slider doble custom ───────────────────────────────────
const track    = document.getElementById('slider-track');
const thumbMin = document.getElementById('thumb-min');
const thumbMax = document.getElementById('thumb-max');
const fillEl   = document.getElementById('slider-fill');
const desdeVal = document.getElementById('desde-val');
const hastaVal = document.getElementById('hasta-val');

let valMin = 1, valMax = 80;
const MIN = 1, MAX = 100;
const PAD = 12; // px-3 = 12px cada lado

function pct(v) { return (v - MIN) / (MAX - MIN) * 100; }

function renderSlider() {
  const trackW = track.offsetWidth - PAD * 2;
  const pMin   = pct(valMin) / 100;
  const pMax   = pct(valMax) / 100;
  thumbMin.style.left = (PAD + pMin * trackW) + 'px';
  thumbMax.style.left = (PAD + pMax * trackW) + 'px';
  fillEl.style.left   = (PAD + pMin * trackW) + 'px';
  fillEl.style.width  = ((pMax - pMin) * trackW) + 'px';
  desdeVal.textContent = valMin + '%';
  hastaVal.textContent = valMax + '%';
}

function startDrag(e, which) {
  e.preventDefault();
  function onMove(ev) {
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const rect    = track.getBoundingClientRect();
    const usable  = rect.width - PAD * 2;
    let ratio = (clientX - rect.left - PAD) / usable;
    ratio = Math.max(0, Math.min(1, ratio));
    const val = Math.round(MIN + ratio * (MAX - MIN));
    if (which === 'min') valMin = Math.min(val, valMax - 1);
    else                 valMax = Math.max(val, valMin + 1);
    renderSlider();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onUp);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend',  onUp);
}

thumbMin.addEventListener('mousedown',  e => startDrag(e, 'min'));
thumbMax.addEventListener('mousedown',  e => startDrag(e, 'max'));
thumbMin.addEventListener('touchstart', e => startDrag(e, 'min'), { passive: false });
thumbMax.addEventListener('touchstart', e => startDrag(e, 'max'), { passive: false });
window.addEventListener('resize', renderSlider);
renderSlider();

// ── Slider capacidad ──────────────────────────────────────
const capEl  = document.getElementById('capacidad');
const capVal = document.getElementById('cap-val');
capEl.addEventListener('input', () => { capVal.textContent = capEl.value + ' kWh'; });

// ── Atajos coste ──────────────────────────────────────────
function setCoste(v) {
  document.getElementById('coste-kwh').value = v.toFixed(2);
}

// ── Cálculo ───────────────────────────────────────────────
function calcular() {
  const potencia  = parseFloat(document.getElementById('potencia').value);
  const desde     = valMin;
  const hasta     = valMax;
  const capacidad = parseInt(capEl.value);
  const precioKwh = parseFloat(document.getElementById('coste-kwh').value) || 0;

  const energiaTotal = capacidad * (hasta - desde) / 100;
  const energiaEnBat = capacidad * hasta / 100;
  const aplicaBMS    = potencia >= BMS_UMBRAL_POT && hasta > BMS_LIMITE_SOC;

  let tiempoTotal = 0, costeTotal = 0;
  let desglose = [], hayBMS = false;

  if (!aplicaBMS) {
    const horas = energiaTotal / potencia;
    const coste = energiaTotal * precioKwh;
    tiempoTotal = horas; costeTotal = coste;
    desglose.push({ label: `${desde}% → ${hasta}%`, kWh: energiaTotal, pot: potencia, horas, coste });
  } else {
    hayBMS = true;
    if (desde < BMS_LIMITE_SOC) {
      const e1 = capacidad * (BMS_LIMITE_SOC - desde) / 100;
      const h1 = e1 / potencia;
      const c1 = e1 * precioKwh;
      tiempoTotal += h1; costeTotal += c1;
      desglose.push({ label: `${desde}% → 80%`, kWh: e1, pot: potencia, horas: h1, coste: c1 });
    }
    const inicio2 = Math.max(desde, BMS_LIMITE_SOC);
    const e2 = capacidad * (hasta - inicio2) / 100;
    const h2 = e2 / BMS_POT_MAX;
    const c2 = e2 * precioKwh;
    tiempoTotal += h2; costeTotal += c2;
    desglose.push({ label: `${inicio2}% → ${hasta}% (BMS)`, kWh: e2, pot: BMS_POT_MAX, horas: h2, coste: c2, bms: true });
  }

  // Mostrar resultado, ocultar empty-state
  const resEl    = document.getElementById('resultado');
  const emptyEl  = document.getElementById('empty-state');
  resEl.classList.remove('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');

  // Métricas
  document.getElementById('tiempo-total').textContent = formatHoras(tiempoTotal);
  document.getElementById('tiempo-desc').textContent  = `${energiaTotal.toFixed(1)} kWh · ${desde}% → ${hasta}%`;
  document.getElementById('coste-total').textContent  = formatEur(costeTotal);
  document.getElementById('coste-desc').textContent   = `${precioKwh.toFixed(3)} €/kWh · ${energiaTotal.toFixed(1)} kWh`;

  // Desglose
  document.getElementById('desglose').innerHTML = desglose.map(d => `
    <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div class="flex justify-between items-start mb-3 gap-2">
        <div class="min-w-0">
          <p class="font-semibold text-white text-sm flex items-center gap-2 flex-wrap">
            ${d.bms ? '<span class="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded-lg mono shrink-0">BMS</span>' : ''}
            <span>Tramo ${d.label}</span>
          </p>
          <p class="mono text-xs text-gray-500 mt-0.5">${d.pot} kW · ${d.kWh.toFixed(2)} kWh</p>
        </div>
        <p class="mono text-base font-bold text-emerald-400 shrink-0">${formatHoras(d.horas)}</p>
      </div>
      <div class="flex justify-between items-center pt-3 border-t border-gray-800">
        <p class="mono text-xs text-gray-500">Coste estimado</p>
        <p class="mono text-lg font-bold text-yellow-300">${formatEur(d.coste)}</p>
      </div>
    </div>
  `).join('');

  // Aviso BMS
  const avisoEl = document.getElementById('aviso-bms');
  avisoEl.classList.toggle('hidden', !hayBMS);
  avisoEl.classList.toggle('flex',   hayBMS);

  // Barra
  document.getElementById('bar-desde').textContent = desde + '%';
  document.getElementById('bar-hasta').textContent = hasta + '%';
  document.getElementById('bar-label').textContent = `${hasta - desde} pts · ${energiaTotal.toFixed(1)} kWh`;
  setTimeout(() => {
    const fill = document.getElementById('bar-fill');
    fill.style.left  = desde + '%';
    fill.style.width = (hasta - desde) + '%';
  }, 50);
  document.getElementById('bar-80').style.opacity =
    (hayBMS && desde < BMS_LIMITE_SOC && hasta > BMS_LIMITE_SOC) ? '1' : '0';

  // Tabla autonomía
  const filas = CONSUMOS.map(c => ({
    consumo  : c,
    kms      : Math.round(energiaEnBat  / c * 100),
    kmsCarg  : Math.round(energiaTotal  / c * 100)
  }));

  document.getElementById('tabla-autonomia').innerHTML = `
    <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div class="px-4 pt-4 pb-3 border-b border-gray-800">
        <p class="text-sm font-semibold text-white">Autonomía estimada al ${hasta}%</p>
        <p class="mono text-xs text-gray-500 mt-0.5">${energiaEnBat.toFixed(1)} kWh en batería · +${energiaTotal.toFixed(1)} kWh cargados ahora</p>
      </div>
      <div class="tabla-scroll">
        <table class="w-full text-sm min-w-[280px]">
          <thead>
            <tr class="border-b border-gray-800">
              <th class="mono text-xs text-gray-500 font-normal text-left px-4 py-2 whitespace-nowrap">Consumo</th>
              <th class="mono text-xs text-gray-500 font-normal text-right px-4 py-2 whitespace-nowrap">Autonomía total</th>
              <th class="mono text-xs text-gray-500 font-normal text-right px-4 py-2 whitespace-nowrap">Kms cargados</th>
            </tr>
          </thead>
          <tbody>
            ${filas.map((f, i) => `
              <tr class="${i < filas.length - 1 ? 'border-b border-gray-800' : ''}">
                <td class="px-4 py-3">
                  <span class="mono text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-lg whitespace-nowrap">${f.consumo} kWh/100km</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <span class="mono font-bold text-base text-sky-300 whitespace-nowrap">${f.kms} km</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <span class="mono text-sm text-emerald-400 whitespace-nowrap">+${f.kmsCarg} km</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // En móvil hacer scroll al resultado
  if (window.innerWidth < 1024) {
    resEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── Utilidades ────────────────────────────────────────────
function formatHoras(h) {
  const totalMin = Math.round(h * 60);
  const horas    = Math.floor(totalMin / 60);
  const mins     = totalMin % 60;
  if (horas === 0) return `${mins} min`;
  if (mins  === 0) return `${horas} h`;
  return `${horas} h ${mins} min`;
}

function formatEur(v) {
  return v.toFixed(2).replace('.', ',') + ' €';
}