import {parseArea} from './number-language.js';
import {recordCalculation} from './analytics.js?v=history-free-8';
import {areaUnits, areaUnitLabel} from './area-units.js?v=english-labels';
import {headers, parseFertilizerRows, calculateFertilizer} from './fertilizer-data.js?v=templates-1';

const number = value => value.toLocaleString('en-IN', {maximumFractionDigits: 2});
const money = value => value.toLocaleString('en-IN', {style: 'currency', currency: 'INR'});
const refFor = (api, db) => api.doc(db, 'calculatorData', 'fertilizer');
const errorText = error => error.code === 'permission-denied'
  ? 'Access denied. The site owner needs to publish the updated calculator database rules.'
  : error.message || 'Unable to load fertilizer data. Please try again.';
export function table(headings, rows) {
  const element = document.createElement('table');
  const head = element.createTHead().insertRow();
  headings.forEach(value => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = value; head.append(cell); });
  const body = element.createTBody();
  rows.forEach(row => { const tr = body.insertRow(); row.forEach(value => { tr.insertCell().textContent = value; }); });
  return element;
}
function validateStored(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.rows)) throw new Error('The fertilizer data format is invalid. Please upload it again.');
  return parseFertilizerRows([headers, ...data.rows.map(row => [row.crop, row.season, row.condition, row.unit, row.urea, row.ssp, row.mop, row.ureaRate, row.sspRate, row.mopRate])]);
}
export function setupAdminFertilizer({api, db, auth}, config = {kind:'fertilizer', sheet:'Fertilizer', headers, parse:parseFertilizerRows, values:row => [row.crop, row.season, row.condition, row.unit, row.urea, row.ssp, row.mop, row.ureaRate, row.sspRate, row.mopRate]}) {
  const kind = config.kind;
  const form = document.getElementById(`${kind}-upload-form`);
  if (!form || form.dataset.ready) return;
  form.dataset.ready = 'true';
  const fileInput = document.getElementById(`${kind}-file`);
  const status = document.getElementById(`${kind}-upload-status`);
  const preview = document.getElementById(`${kind}-preview`);
  const save = document.getElementById(`${kind}-save`);
  const uploaded = document.createElement('p');
  uploaded.className = 'uploaded-sheet';
  uploaded.textContent = 'Loading uploaded sheet…';
  form.before(uploaded);
  let pending = null, selection = 0, savedRevision = 0;
  const urls = new Map();
  function fileLink(container, blob, name, label) {
    if (urls.has(container)) URL.revokeObjectURL(urls.get(container));
    const url = URL.createObjectURL(blob);
    urls.set(container, url);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.textContent = `${label}: ${name}`;
    container.replaceChildren(link);
  }
  function showSaved(data) {
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook,
      window.XLSX.utils.aoa_to_sheet([config.headers, ...data.rows.map(config.values)]), config.sheet);
    const bytes = window.XLSX.write(workbook, {bookType:'xlsx', type:'array'});
    const blob = new Blob([bytes], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const name = data.sourceName || `${kind}.xlsx`;
    fileLink(uploaded, blob, name, 'Download uploaded data');
    uploaded.title = 'Excel export of the saved calculator data; original workbook formatting and extra sheets are not retained.';
  }
  api.getDocFromServer(api.doc(db, 'calculatorData', kind)).then(snapshot => {
    if (savedRevision) return;
    if (snapshot.exists()) showSaved(snapshot.data());
    else uploaded.textContent = 'No sheet uploaded yet.';
  }).catch(error => {
    if (!savedRevision) uploaded.textContent = errorText(error);
  });
  window.addEventListener('pagehide', () => {
    for (const url of urls.values()) URL.revokeObjectURL(url);
  });
  fileInput.addEventListener('change', async () => {
    const current = ++selection;
    pending = null; save.disabled = true; preview.replaceChildren(); status.textContent = '';
    if (urls.has(preview)) { URL.revokeObjectURL(urls.get(preview)); urls.delete(preview); }
    const file = fileInput.files[0];
    if (!file) return;
    try {
      if (!/\.xlsx$/i.test(file.name) || file.size > 2 * 1024 * 1024) throw new Error('Choose an .xlsx file smaller than 2 MB.');
      if (!window.XLSX) throw new Error('The Excel reader did not load. Refresh the page and try again.');
      const workbook = window.XLSX.read(await file.arrayBuffer(), {type: 'array'});
      if (current !== selection) return;
      const sheet = workbook.Sheets[config.sheet] || (workbook.SheetNames.length === 1 ? workbook.Sheets[workbook.SheetNames[0]] : null);
      if (!sheet) throw new Error(`The workbook needs a sheet named ${config.sheet}.`);
      const range = window.XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      if (range.e.r > 200 || range.e.c >= config.headers.length) throw new Error(`Keep the ${config.sheet} sheet to ${config.headers.length} columns and at most 200 data rows. Put notes on a separate sheet.`);
      for (const [address, cell] of Object.entries(sheet)) {
        if (!address.startsWith('!') && cell.f) throw new Error('Upload numeric values, not formulas. In Excel, copy and Paste Values first.');
      }
      const rows = config.parse(window.XLSX.utils.sheet_to_json(sheet, {header: 1, defval: '', raw: true}));
      pending = {rows, sourceName: file.name};
      fileLink(preview, file, file.name, 'Selected sheet');
      status.textContent = `${rows.length} rows checked. Saving replaces the previous ${kind} dataset.`;
      save.disabled = false;
    } catch (error) { if (current === selection) status.textContent = errorText(error); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!pending || !auth.currentUser?.emailVerified || !window.agriAuthenticated) return;
    save.disabled = true; fileInput.disabled = true;
    status.textContent = `Saving ${kind} data…`;
    try {
      await api.setDoc(api.doc(db, 'calculatorData', kind), {...pending, schemaVersion: 1, updatedBy: auth.currentUser.uid, updatedAt: api.serverTimestamp()});
      savedRevision++;
      showSaved(pending);
      status.textContent = 'Sheet saved. Members can now use this data.';
      preview.replaceChildren();
      fileInput.value = '';
      pending = null;
    } catch (error) { status.textContent = errorText(error); }
    finally { fileInput.disabled = false; save.disabled = !pending; }
  });
}

export async function setupFertilizerCalculator({api, db, auth}) {
  const form = document.getElementById('fertilizer-form');
  if (!form || form.dataset.ready) return;
  form.dataset.ready = 'true';
  const crop = document.getElementById('fertilizer-crop');
  const season = document.getElementById('season');
  const unit = document.getElementById('fertilizer-unit');
  const condition = document.getElementById('fertilizer-condition');
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('fertilizer-status');
  const result = document.getElementById('fertilizer-result');
  let rows = [];
  const options = (select, values) => {
    const old = select.value;
    select.replaceChildren(...values.map(value => new Option(select === unit ? areaUnitLabel(value) : value, value)));
    if (values.includes(old)) select.value = old;
  };
  const clear = () => result.classList.add('hidden');
  const updateUnits = () => { options(unit, areaUnits.map(entry => entry.value)); clear(); };
  const updateConditions = () => { options(condition, [...new Set(rows.filter(row => row.crop === crop.value && row.season === season.value).map(row => row.condition))]); updateUnits(); };
  const updateSeasons = () => { options(season, [...new Set(rows.filter(row => row.crop === crop.value).map(row => row.season))]); updateConditions(); };
  crop.addEventListener('change', updateSeasons);
  season.addEventListener('change', updateConditions);
  condition.addEventListener('change', updateUnits);
  form.addEventListener('input', clear);
  form.addEventListener('change', clear);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!auth.currentUser?.emailVerified || !window.agriAuthenticated) return;
    if (!navigator.onLine) { clear(); status.textContent = 'Connect to the internet to calculate.'; return; }
    try {
      const area = parseArea(document.getElementById('fertilizer-area').value);
      const calculation = calculateFertilizer(rows, crop.value, season.value, condition.value, unit.value, area);
      const title = document.createElement('h3'); title.textContent = 'Fertilizer quantities and estimated cost';
      const summary = document.createElement('p'); summary.textContent = `${crop.value} · ${season.value} · ${condition.value} · ${number(area)} ${areaUnitLabel(unit.value)}`;
      const total = document.createElement('p'); total.className = 'fertilizer-total'; total.textContent = `Total estimated cost: ${money(calculation.total)}`;
      const wrapper = document.createElement('div'); wrapper.className = 'table-scroll';
      wrapper.append(table(['Fertilizer', 'Quantity (kg)', 'Rate / kg', 'Estimated cost'], calculation.items.map(item => [item.name, number(item.quantity), money(item.rate), money(item.cost)])));
      result.replaceChildren(title, summary, wrapper, total);
      result.classList.remove('hidden');
      recordCalculation({api,db,auth},'fertilizer',{crop:crop.value,season:season.value,condition:condition.value,unit:unit.value},area,calculation);
    } catch (error) { clear(); status.textContent = errorText(error); }
  });
  try {
    const snapshot = await api.getDocFromServer(refFor(api, db));
    if (!auth.currentUser?.emailVerified || !window.agriAuthenticated) return;
    if (!snapshot.exists()) throw new Error('Fertilizer data is not available yet. Please ask the administrator to upload the Excel sheet.');
    rows = validateStored(snapshot.data());
    options(crop, [...new Set(rows.map(row => row.crop))]); updateSeasons();
    status.textContent = 'Quantities and prices use the latest uploaded sheet. Prices are in rupees per kg.';
    button.disabled = false;
  } catch (error) { status.textContent = errorText(error); button.disabled = true; }
}
