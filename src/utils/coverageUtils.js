export function sortCoverageByDateDesc(items) {
  return [...items].sort((a,b)=>{
    const da = a.CoverageDate ? new Date(a.CoverageDate) : new Date(0);
    const db = b.CoverageDate ? new Date(b.CoverageDate) : new Date(0);
    return db - da;
  });
}

export function formatDuration(hoursStr) {
  if (!hoursStr) return '0 Hrs';
  const h = parseFloat(hoursStr);
  if (isNaN(h)) return hoursStr + ' Hrs';
  if (h === Math.floor(h)) return `${Math.floor(h)} Hrs`;
  return `${h.toFixed(1)} Hrs`;
}