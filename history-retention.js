// Clamp month-end dates rather than letting Date roll into the following month.
export function shiftMonths(value, months) {
  const date=new Date(value);
  const day=date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth()+months);
  const lastDay=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
  date.setDate(Math.min(day,lastDay));
  return date;
}
export function historyCutoff(period, now=new Date(), months=3) {
  const oldest=shiftMonths(now,-months);
  const selected=period==='180'?shiftMonths(now,-6):period==='365'?shiftMonths(now,-12):
    period==='3months'?shiftMonths(now,-3):new Date(now.getTime()-Number(period)*86400000);
  return new Date(Math.max(oldest.getTime(),Number.isFinite(selected.getTime())?selected.getTime():oldest.getTime()));
}
