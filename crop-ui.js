import {parseArea} from './number-language.js';
import {recordCalculation} from './analytics.js?v=history-free-8';
import {areaUnits, areaUnitLabel} from './area-units.js?v=english-labels';
import {cropConfigs, cropRowValues, parseCropRows, calculateCrop} from './crop-data.js?v=templates-1';
import {setupAdminFertilizer, table} from './fertilizer-ui.js?v=history-1';
const number = value => value.toLocaleString('en-IN', {maximumFractionDigits:2});
export function setupAdminCrops(context) {
  for (const kind of ['seed','yield']) setupAdminFertilizer(context, {
    ...cropConfigs[kind], kind, parse: matrix=>parseCropRows(kind,matrix), values:row=>cropRowValues(kind,row)
  });
}
export async function setupCropCalculator(kind, {api,db,auth}) {
  const form = document.getElementById(`${kind}-form`);
  if (!form || form.dataset.ready) return;
  form.dataset.ready = 'true';
  const config = cropConfigs[kind];
  const controls = Object.fromEntries(['crop','season','condition','unit','area'].map(key=>[key,document.getElementById(`${kind}-${key}`)]));
  const status = document.getElementById(`${kind}-status`);
  const result = document.getElementById(`${kind}-result`);
  const submit = form.querySelector('button[type="submit"]');
  let rows = [];
  const options = (select, values) => {
    const previous = select.value;
    select.replaceChildren(...values.map(value=>new Option(select === controls.unit ? areaUnitLabel(value) : value, value)));
    if (values.includes(previous)) select.value = previous;
  };
  const clear = () => result.classList.add('hidden');
  const conditions = () => { options(controls.condition,[...new Set(rows.filter(row=>row.crop === controls.crop.value && row.season === controls.season.value).map(row=>row.condition))]); clear(); };
  const seasons = () => { options(controls.season,[...new Set(rows.filter(row=>row.crop === controls.crop.value).map(row=>row.season))]); conditions(); };
  controls.crop.addEventListener('change',seasons);
  controls.season.addEventListener('change',conditions);
  form.addEventListener('change',clear); form.addEventListener('input',clear);
  form.addEventListener('submit',event=> {
    event.preventDefault();
    if (!auth.currentUser?.emailVerified || !window.agriAuthenticated) return;
    if (!navigator.onLine) { clear(); status.textContent = 'Connect to the internet to calculate.'; return; }
    try {
      const selection = Object.fromEntries(['crop','season','condition','unit'].map(key=>[key,controls[key].value]));
      const area = parseArea(controls.area.value);
      const calculation = calculateCrop(kind,rows,selection,area);
      const heading = document.createElement('h3'); heading.textContent = config.title;
      const summary = document.createElement('p'); summary.textContent = `${selection.crop} · ${selection.season} · ${selection.condition} · ${number(area)} ${areaUnitLabel(selection.unit)}`;
      const values = kind === 'seed' ? [
        ['Seed required',`${number(calculation.quantity)} kg`],
        ['Row spacing',`${number(calculation.rowSpacing)} cm`],
        ['Plant spacing',typeof calculation.plantSpacing === 'number' ? `${number(calculation.plantSpacing)} cm` : calculation.plantSpacing],
        ['Estimated plant population',calculation.population === null ? 'Not calculated for continuous sowing' : `${number(calculation.population)} plants`]
      ] : [
        [`Expected yield per ${areaUnitLabel(selection.unit)}`,`${number(calculation.perUnit)} kg`],
        ['Estimated total production',`${number(calculation.total)} kg`],
        ['Estimated total production in quintals',`${number(calculation.quintals)} q`]
      ];
      const wrapper = document.createElement('div'); wrapper.className = 'table-scroll'; wrapper.append(table(['Measure','Value'],values));
      const note = document.createElement('p'); note.className = 'result-note'; note.textContent = kind === 'yield'
        ? 'Estimate = expected yield per area from the uploaded sheet × your land area. Actual harvest may differ.'
        : 'Seed quantity uses the uploaded rate. Plant population assumes one plant per spacing position.';
      result.replaceChildren(heading,summary,wrapper,note); result.classList.remove('hidden');
      recordCalculation({api,db,auth}, kind, selection, area, calculation);
    } catch(error) { clear(); status.textContent = error.message; }
  });
  try {
    const snapshot = await api.getDocFromServer(api.doc(db,'calculatorData',kind));
    if (!auth.currentUser?.emailVerified || !window.agriAuthenticated) return;
    if (!snapshot.exists()) throw new Error(`No ${config.title.toLowerCase()} data yet. Ask the administrator to upload the sample or an approved sheet.`);
    const data = snapshot.data();
    if (data.schemaVersion !== 1 || !Array.isArray(data.rows)) throw new Error('Invalid dataset. Please upload the Excel sheet again.');
    rows = parseCropRows(kind,[config.headers,...data.rows.map(row=>cropRowValues(kind,row))]);
    options(controls.crop,[...new Set(rows.map(row=>row.crop))]);
    options(controls.unit,areaUnits.map(unit=>unit.value)); seasons();
    submit.disabled = false; status.textContent = 'Using the latest uploaded crop data.';
  } catch(error) {
    submit.disabled = true;
    status.textContent = error.code === 'permission-denied' ? 'Access denied. The site owner needs to publish the updated calculator database rules.' : error.message;
  }
}
