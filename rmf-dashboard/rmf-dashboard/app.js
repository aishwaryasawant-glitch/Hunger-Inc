/* ---------- Data & Config ---------- */
const OUTLETS = [
  {code:'TBC', name:'The Bombay Canteen'},
  {code:'OP', name:'O Pedro'},
  {code:'PAPAS', name:"Papa's"},
  {code:'VERO_BANDRA', name:"Veronica's Bandra"},
  {code:'VERO_LP', name:"Veronica's Lower Parel"},
];

const METRICS = [
  {key:'covers', label:'Covers', unit:'count', total:'covers', parts:null},
  {key:'revenue', label:'Net Revenue by Category', unit:'currency', total:'rev_total',
    parts:[['rev_food','Food'],['rev_liquor','Liquor, Wine & Beer'],['rev_otherbev','Other Beverages'],['rev_othersales','Other Sales']]},
  {key:'gp', label:'Gross Profit by Category', unit:'currency', total:'gp_total',
    parts:[['gp_food','Food'],['gp_liquor','Liquor, Wine & Beer'],['gp_otherbev','Other Beverages'],['gp_othersales','Other Sales']]},
  {key:'teamcost', label:'Team Costs (Net)', unit:'currency', total:'team_cost', parts:null},
  {key:'avgsalary', label:'Average Net Salary / Person', unit:'currency', total:'avg_salary', parts:null},
  {key:'revpercover', label:'Net Revenue / Cover', unit:'currency', total:'rev_per_cover', parts:null},
  {key:'gppercover', label:'Gross Profit / Cover', unit:'currency', total:'gp_per_cover', parts:null},
];

const ADMIN_FIELDS = [
  {k:'covers', l:'Total Covers', group:'Covers'},
  {k:'rev_food', l:'Food', group:'Net Revenue'},
  {k:'rev_liquor', l:'Liquor, Wine & Beer', group:'Net Revenue'},
  {k:'rev_otherbev', l:'Other Beverages', group:'Net Revenue'},
  {k:'rev_othersales', l:'Other Sales', group:'Net Revenue'},
  {k:'gp_food', l:'Food', group:'Gross Profit'},
  {k:'gp_liquor', l:'Liquor, Wine & Beer', group:'Gross Profit'},
  {k:'gp_otherbev', l:'Other Beverages', group:'Gross Profit'},
  {k:'gp_othersales', l:'Other Sales / Cost of Other Sales', group:'Gross Profit'},
  {k:'team_cost', l:'Total Team Cost (Net)', group:'Team'},
  {k:'team_size', l:'Total Team Size (headcount)', group:'Team'},
];

const OUTLET_COLORS = {
  TBC:         {def:'#8EA6DD', hi:'#13294B'},
  OP:          {def:'#FFC000', hi:'#1A5C38'},
  VERO_BANDRA: {def:'#E94E24', hi:'#FFC000'},
  VERO_LP:     {def:'#E94E24', hi:'#FFC000'},
  PAPAS:       {def:'#C3A08C', hi:'#8EA6DD'},
};

let EXTRA_DATA = {};
let allDocs = {}; // key: OUTLET_YYYY-MM -> record
let state = { tab:'dashboard', outlet:'TBC', month:null, adminOutlet:'TBC', adminMonth:null };

/* ---------- Month utilities ---------- */
function addMonths(ym, n){
  let [y,m] = ym.split('-').map(Number);
  m += n;
  y += Math.floor((m-1)/12);
  m = ((m-1)%12+12)%12 + 1;
  return y+'-'+String(m).padStart(2,'0');
}
function window25(sel){
  let cur = addMonths(sel,-24), out=[];
  for(let i=0;i<25;i++){ out.push(cur); cur=addMonths(cur,1); }
  return out;
}
function monthLabel(ym){
  const [y,m]=ym.split('-').map(Number);
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]+" '"+String(y).slice(2);
}

/* ---------- Data access ---------- */
function recKey(outlet,month){ return outlet+'_'+month; }
function getRec(outlet,month){ return allDocs[recKey(outlet,month)] || null; }
function getVal(outlet,month,field){
  const r = getRec(outlet,month);
  return r && r[field]!=null ? r[field] : null;
}
function allMonthsWithData(outlet){
  return Object.keys(allDocs).filter(k=>k.startsWith(outlet+'_')).map(k=>k.slice(outlet.length+1)).sort();
}
function latestMonthWithData(outlet){
  const ms = allMonthsWithData(outlet);
  return ms.length ? ms[ms.length-1] : null;
}

/* ---------- Formatting ---------- */
function fmtNum(v, unit){
  if(v==null || isNaN(v)) return '\u2013';
  const sign = v<0 ? '-' : '';
  const abs = Math.abs(v);
  const cur = unit==='currency' ? '\u20b9' : '';
  if(unit==='currency'){
    if(abs>=1e7) return sign+cur+(abs/1e7).toFixed(2)+'Cr';
    if(abs>=1e5) return sign+cur+(abs/1e5).toFixed(2)+'L';
    if(abs>=1e3) return sign+cur+(abs/1e3).toFixed(1)+'k';
    return sign+cur+Math.round(abs);
  }
  if(abs>=1e5) return sign+(abs/1e5).toFixed(2)+'L';
  if(abs>=1e3) return sign+(abs/1e3).toFixed(1)+'k';
  return sign+Math.round(abs);
}
function median(arr){
  const vals = arr.filter(v=>v!=null && !isNaN(v)).sort((a,b)=>a-b);
  if(!vals.length) return null;
  const mid = Math.floor(vals.length/2);
  return vals.length%2 ? vals[mid] : (vals[mid-1]+vals[mid])/2;
}

/* ---------- Chart rendering (inline SVG) ---------- */
const PARTCOLORS = ['#5B8DEF','#7BC8A4','#F5A25D','#E67399'];
function renderChart(metric, outlet, selMonth){
  const win = window25(selMonth);
  const highlight1 = selMonth;
  const highlight2 = addMonths(selMonth,-12);
  const totals = win.map(m=>getVal(outlet,m,metric.total));
  const trailing12 = [];
  for(let i=0;i<12;i++){ trailing12.push(getVal(outlet, addMonths(selMonth,-i), metric.total)); }
  const med = median(trailing12);

  const W=980,H=250,padL=54,padR=16,padT=18,padB=54;
  const plotW = W-padL-padR, plotH=H-padT-padB;
  const barW = plotW/win.length*0.62;
  const gap = plotW/win.length;

  const validTotals = totals.filter(v=>v!=null);
  let maxV = validTotals.length ? Math.max(...validTotals) : 1;
  let minV = validTotals.length ? Math.min(0,Math.min(...validTotals)) : 0;
  if(maxV===0) maxV=1;
  const range = maxV-minV || 1;
  function y(v){ return padT + plotH - ((v-minV)/range)*plotH; }
  const zeroY = y(0);

  let bars='', labels='', yoyRow='';
  win.forEach((m,i)=>{
    const cx = padL + gap*i + gap/2;
    const isHi = (m===highlight1 || m===highlight2);
    const rec = getRec(outlet,m);
    if(metric.parts && rec){
      // stacked bar
      let base = 0, segs='';
      const total = totals[i];
      if(total!=null){
        metric.parts.forEach((p,pi)=>{
          const pv = rec[p[0]];
          if(pv==null) return;
          const y0 = y(base), y1 = y(base+pv);
          const h = Math.max(0, y0-y1);
          const col = isHi ? PARTCOLORS[pi] : PARTCOLORS[pi]+'99';
          segs += '<rect x="'+(cx-barW/2)+'" y="'+y1+'" width="'+barW+'" height="'+h+'" fill="'+col+'"><title>'+p[1]+': '+fmtNum(pv,metric.unit)+'</title></rect>';
          base += pv;
        });
      }
      bars += segs;
    } else if(totals[i]!=null){
      const v=totals[i];
      const y0=zeroY, y1=y(v);
      const top=Math.min(y0,y1), h=Math.max(2,Math.abs(y1-y0));
      const oc = OUTLET_COLORS[outlet] || {def:'#8aa2e0',hi:'#3b5bdb'};
      const col = isHi ? oc.hi : oc.def;
      bars += '<rect x="'+(cx-barW/2)+'" y="'+top+'" width="'+barW+'" height="'+h+'" fill="'+col+'" rx="2"><title>'+monthLabel(m)+': '+fmtNum(v,metric.unit)+'</title></rect>';
    }
    if(i%2===0 || win.length<=13){
      labels += '<text x="'+cx+'" y="'+(H-padB+16)+'" font-size="9" fill="var(--muted)" text-anchor="end" transform="rotate(-55 '+cx+' '+(H-padB+16)+')">'+monthLabel(m)+'</text>';
    }
    // YoY
    const prior = getVal(outlet, addMonths(m,-12), metric.total);
    if(totals[i]!=null && prior!=null && prior!==0){
      const yoy = (totals[i]-prior)/prior*100;
      const col = yoy>=0 ? 'var(--pos)' : 'var(--neg)';
      yoyRow += '<text x="'+cx+'" y="10" font-size="8" fill="'+col+'" text-anchor="middle">'+(yoy>=0?'+':'')+yoy.toFixed(0)+'%</text>';
    }
  });

  let medLine='';
  if(med!=null){
    const my=y(med);
    medLine = '<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+my+'" y2="'+my+'" stroke="var(--median)" stroke-width="1.5" stroke-dasharray="5,4"/>'+
      '<text x="'+(W-padR)+'" y="'+(my-4)+'" font-size="9" fill="var(--median)" text-anchor="end">median (trailing 12mo): '+fmtNum(med,metric.unit)+'</text>';
  }

  const axisLine = '<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+zeroY+'" y2="'+zeroY+'" stroke="var(--axis)" stroke-width="1"/>';
  const maxLabel = '<text x="'+(padL-6)+'" y="'+(padT+4)+'" font-size="9" fill="var(--muted)" text-anchor="end">'+fmtNum(maxV,metric.unit)+'</text>';

  let legend='';
  if(metric.parts){
    legend = '<div class="legend">'+metric.parts.map((p,pi)=>'<span class="lg-item"><i style="background:'+PARTCOLORS[pi]+'"></i>'+p[1]+'</span>').join('')+'</div>';
  }

  return '<div class="chart-card">'+
    '<div class="chart-head"><h3>'+metric.label+'</h3>'+legend+'</div>'+
    '<svg viewBox="0 0 '+W+' '+H+'" class="chart-svg" preserveAspectRatio="xMinYMid meet">'+
      '<g class="yoy-row">'+yoyRow+'</g>'+
      axisLine+maxLabel+bars+medLine+labels+
    '</svg></div>';
}

/* ---------- Static (PPTX-sourced, read-only) extra chart data ---------- */
const SECTION_DEFS = [
  {key:'snapshot', label:'APC & Covers Snapshot', group:'overview_extra'},
  {key:'meal_period', label:'By Meal Period', group:'meal_period'},
  {key:'dine_vs_lp', label:'Dine-In vs Large Party', group:'dine_vs_lp'},
  {key:'revenue_split', label:'Revenue Split', group:'revenue'},
  {key:'cogs', label:'COGS', group:['cogs','cogs_percover','cogs_ideal']},
  {key:'people', label:'People', group:['people_cost','people_covers_emp']},
];

function cardsForOutlet(outlet, groupOrList){
  const all = (EXTRA_DATA[outlet] || []);
  const groups = Array.isArray(groupOrList) ? groupOrList : [groupOrList];
  return all.filter(c => groups.includes(c.group));
}
function availableSections(outlet){
  return SECTION_DEFS.filter(sd => cardsForOutlet(outlet, sd.group).length>0);
}

function seriesToMap(months, values){
  const m = {};
  for(let i=0;i<months.length;i++){ if(values[i]!=null) m[months[i]] = values[i]; }
  return m;
}

/* Render one static series as a bar chart (single metric, read-only) sharing the
   same window/highlight/median/YoY treatment as the live metrics. */
function renderStaticSeries(label, valMap, selMonth, colDef, colHi, unit){
  const win = window25(selMonth);
  const highlight1 = selMonth, highlight2 = addMonths(selMonth,-12);
  const totals = win.map(m=> valMap[m]!=null ? valMap[m] : null);
  const trailing12 = []; for(let i=0;i<12;i++){ trailing12.push(valMap[addMonths(selMonth,-i)]!=null?valMap[addMonths(selMonth,-i)]:null); }
  const med = median(trailing12);

  const W=980,H=220,padL=54,padR=16,padT=16,padB=50;
  const plotW=W-padL-padR, plotH=H-padT-padB;
  const barW = plotW/win.length*0.62, gap=plotW/win.length;
  const validTotals = totals.filter(v=>v!=null);
  let maxV = validTotals.length? Math.max(...validTotals):1;
  let minV = validTotals.length? Math.min(0,Math.min(...validTotals)):0;
  if(maxV===0) maxV=1;
  const range = maxV-minV || 1;
  function y(v){ return padT+plotH-((v-minV)/range)*plotH; }
  const zeroY = y(0);

  let bars='', labels='', yoyRow='';
  win.forEach((m,i)=>{
    const cx = padL+gap*i+gap/2;
    const isHi = (m===highlight1||m===highlight2);
    if(totals[i]!=null){
      const v=totals[i], y0=zeroY, y1=y(v);
      const top=Math.min(y0,y1), h=Math.max(2,Math.abs(y1-y0));
      bars += '<rect x="'+(cx-barW/2)+'" y="'+top+'" width="'+barW+'" height="'+h+'" fill="'+(isHi?colHi:colDef)+'" rx="2"><title>'+monthLabel(m)+': '+fmtNum(v,unit)+'</title></rect>';
    }
    if(i%2===0 || win.length<=13){
      labels += '<text x="'+cx+'" y="'+(H-padB+16)+'" font-size="9" fill="var(--muted)" text-anchor="end" transform="rotate(-55 '+cx+' '+(H-padB+16)+')">'+monthLabel(m)+'</text>';
    }
    const prior = valMap[addMonths(m,-12)];
    if(totals[i]!=null && prior!=null && prior!==0){
      const yoy=(totals[i]-prior)/prior*100;
      const col = yoy>=0?'var(--pos)':'var(--neg)';
      yoyRow += '<text x="'+cx+'" y="10" font-size="8" fill="'+col+'" text-anchor="middle">'+(yoy>=0?'+':'')+yoy.toFixed(0)+'%</text>';
    }
  });
  let medLine='';
  if(med!=null){
    const my=y(med);
    medLine = '<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+my+'" y2="'+my+'" stroke="var(--median)" stroke-width="1.5" stroke-dasharray="5,4"/>'+
      '<text x="'+(W-padR)+'" y="'+(my-4)+'" font-size="9" fill="var(--median)" text-anchor="end">median (trailing 12mo): '+fmtNum(med,unit)+'</text>';
  }
  const axisLine = '<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+zeroY+'" y2="'+zeroY+'" stroke="var(--axis)"/>';
  const maxLabel = '<text x="'+(padL-6)+'" y="'+(padT+4)+'" font-size="9" fill="var(--muted)" text-anchor="end">'+fmtNum(maxV,unit)+'</text>';
  const hasAny = validTotals.length>0;
  return '<div class="chart-card"><div class="chart-head"><h3>'+label+'</h3></div>'+
    (hasAny ? ('<svg viewBox="0 0 '+W+' '+H+'" class="chart-svg" preserveAspectRatio="xMinYMid meet">'+
      '<g>'+yoyRow+'</g>'+axisLine+maxLabel+bars+medLine+labels+'</svg>')
      : '<p class="empty">No data in this window.</p>') +
    '</div>';
}

/* Grouped (actual vs ideal) comparison chart for Ideal vs Actual COGS cards */
function renderGroupedSeries(title, seriesA, seriesB, selMonth, colA, colB, unit){
  const win = window25(selMonth);
  const W=980,H=220,padL=54,padR=16,padT=16,padB=50;
  const plotW=W-padL-padR, plotH=H-padT-padB;
  const gap=plotW/win.length, barW=gap*0.32;
  const allVals = win.flatMap(m=>[seriesA[m],seriesB[m]]).filter(v=>v!=null);
  let maxV = allVals.length?Math.max(...allVals):1; if(maxV===0) maxV=1;
  function y(v){ return padT+plotH-(v/maxV)*plotH; }
  const zeroY = y(0);
  let bars='', labels='';
  win.forEach((m,i)=>{
    const cx = padL+gap*i+gap/2;
    const va = seriesA[m], vb = seriesB[m];
    if(va!=null){ const h=Math.max(1,zeroY-y(va)); bars += '<rect x="'+(cx-barW-1)+'" y="'+y(va)+'" width="'+barW+'" height="'+h+'" fill="'+colA+'"><title>Actual '+monthLabel(m)+': '+fmtNum(va,unit)+'</title></rect>'; }
    if(vb!=null){ const h=Math.max(1,zeroY-y(vb)); bars += '<rect x="'+(cx+1)+'" y="'+y(vb)+'" width="'+barW+'" height="'+h+'" fill="'+colB+'"><title>Ideal '+monthLabel(m)+': '+fmtNum(vb,unit)+'</title></rect>'; }
    if(i%2===0 || win.length<=13){
      labels += '<text x="'+cx+'" y="'+(H-padB+16)+'" font-size="9" fill="var(--muted)" text-anchor="end" transform="rotate(-55 '+cx+' '+(H-padB+16)+')">'+monthLabel(m)+'</text>';
    }
  });
  const axisLine = '<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+zeroY+'" y2="'+zeroY+'" stroke="var(--axis)"/>';
  const legend = '<div class="legend"><span class="lg-item"><i style="background:'+colA+'"></i>Actual</span><span class="lg-item"><i style="background:'+colB+'"></i>Ideal (Recipe)</span></div>';
  const hasAny = allVals.length>0;
  return '<div class="chart-card"><div class="chart-head"><h3>'+title+'</h3>'+legend+'</div>'+
    (hasAny ? ('<svg viewBox="0 0 '+W+' '+H+'" class="chart-svg" preserveAspectRatio="xMinYMid meet">'+axisLine+bars+labels+'</svg>')
      : '<p class="empty">No data in this window.</p>') +
    '</div>';
}

function renderCard(card, outlet, selMonth){
  const oc = OUTLET_COLORS[outlet] || {def:'#8aa2e0',hi:'#3b5bdb'};
  const unit = /cost|revenue|apc|cogs/i.test(card.title) ? 'currency' : 'count';
  // Ideal vs Actual: exactly 2 series, "Actual"/"Recipe" style labels -> grouped comparison
  if(card.series.length===2 && /actual/i.test(card.series[0].label) ){
    const a = seriesToMap(card.series[0].months, card.series[0].values);
    const b = seriesToMap(card.series[1].months, card.series[1].values);
    return renderGroupedSeries(card.title, a, b, selMonth, oc.hi, oc.def+'80', 'currency');
  }
  // Revenue split with a Total among 3 series -> stack the two non-total parts
  if(card.group==='revenue' && card.series.length===3){
    const totalIdx = card.series.findIndex(s=>/total/i.test(s.label));
    if(totalIdx>=0){
      const parts = card.series.filter((_,i)=>i!==totalIdx);
      const maps = parts.map(p=>seriesToMap(p.months,p.values));
      return renderStackedParts(card.title, parts.map(p=>p.label), maps, selMonth, oc);
    }
  }
  // default: one chart per series in this card
  return card.series.map(s=>{
    const m = seriesToMap(s.months, s.values);
    const label = card.series.length>1 ? (card.title+' — '+s.label) : card.title;
    return renderStaticSeries(label, m, selMonth, oc.def, oc.hi, unit);
  }).join('');
}

function renderStackedParts(title, labels, maps, selMonth, oc){
  const win = window25(selMonth);
  const highlight1=selMonth, highlight2=addMonths(selMonth,-12);
  const PART_COLS = [oc.def, oc.hi+'99'];
  const totals = win.map(m => maps.reduce((s,mm)=> s + (mm[m]!=null? mm[m]:0), 0));
  const validTotals = win.map((m,i)=>maps.some(mm=>mm[m]!=null) ? totals[i] : null).filter(v=>v!=null);
  const W=980,H=220,padL=54,padR=16,padT=16,padB=50;
  const plotW=W-padL-padR, plotH=H-padT-padB;
  const barW=plotW/win.length*0.62, gap=plotW/win.length;
  let maxV = validTotals.length?Math.max(...validTotals):1; if(maxV===0) maxV=1;
  function y(v){ return padT+plotH-(v/maxV)*plotH; }
  let bars='', labelsSvg='';
  win.forEach((m,i)=>{
    const cx=padL+gap*i+gap/2;
    const any = maps.some(mm=>mm[m]!=null);
    if(any){
      let base=0;
      maps.forEach((mm,pi)=>{
        const v = mm[m]; if(v==null) return;
        const y0=y(base), y1=y(base+v), h=Math.max(0,y0-y1);
        bars += '<rect x="'+(cx-barW/2)+'" y="'+y1+'" width="'+barW+'" height="'+h+'" fill="'+PART_COLS[pi%2]+'"><title>'+labels[pi]+': '+fmtNum(v,'currency')+'</title></rect>';
        base += v;
      });
    }
    if(i%2===0||win.length<=13){
      labelsSvg += '<text x="'+cx+'" y="'+(H-padB+16)+'" font-size="9" fill="var(--muted)" text-anchor="end" transform="rotate(-55 '+cx+' '+(H-padB+16)+')">'+monthLabel(m)+'</text>';
    }
  });
  const axisLine = '<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+y(0)+'" y2="'+y(0)+'" stroke="var(--axis)"/>';
  const legend = '<div class="legend">'+labels.map((l,i)=>'<span class="lg-item"><i style="background:'+PART_COLS[i%2]+'"></i>'+l+'</span>').join('')+'</div>';
  const hasAny = validTotals.length>0;
  return '<div class="chart-card"><div class="chart-head"><h3>'+title+'</h3>'+legend+'</div>'+
    (hasAny ? ('<svg viewBox="0 0 '+W+' '+H+'" class="chart-svg" preserveAspectRatio="xMinYMid meet">'+axisLine+bars+labelsSvg+'</svg>')
      : '<p class="empty">No data in this window.</p>') +
    '</div>';
}

/* ---------- Rendering: Dashboard tab ---------- */
function renderDashboard(){
  const outlet = state.outlet;
  const months = allMonthsWithData(outlet);
  if(!state.month || !months.includes(state.month)) state.month = latestMonthWithData(outlet);
  const sel = state.month;

  let monthOpts = months.map(m=>'<option value="'+m+'" '+(m===sel?'selected':'')+'>'+monthLabel(m)+' ('+m+')</option>').join('');

  const sections = availableSections(outlet);
  if(!state.section || !['overview',...sections.map(s=>s.key)].includes(state.section)) state.section='overview';
  let sectionTabs = '<button class="pill sec '+(state.section==='overview'?'active':'')+'" data-section="overview">Overview</button>'+
    sections.map(sd=>'<button class="pill sec '+(state.section===sd.key?'active':'')+'" data-section="'+sd.key+'">'+sd.label+'</button>').join('');

  let body;
  if(!sel){
    body = '<p class="empty">No data yet for this outlet.</p>';
  } else if(state.section==='overview'){
    body = METRICS.map(met=>renderChart(met,outlet,sel)).join('');
  } else {
    const sd = sections.find(s=>s.key===state.section);
    const cards = cardsForOutlet(outlet, sd.group);
    if(sd.key==='meal_period'){
      const meals = [...new Set(cards.map(c=>c.meal).filter(Boolean))];
      body = meals.map(meal=>{
        const mealCards = cards.filter(c=>c.meal===meal);
        return '<h4 class="section-sub">'+meal+'</h4><div class="chart-grid">'+
          mealCards.map(c=>renderCard(c,outlet,sel)).join('')+'</div>';
      }).join('');
    } else {
      body = '<div class="chart-grid">'+cards.map(c=>renderCard(c,outlet,sel)).join('')+'</div>';
    }
  }

  return '<div class="panel">'+
    '<div class="controls-row"><label>Selected month <select id="monthSelect">'+monthOpts+'</select></label>'+
    '<span class="hint">Window shown: '+(sel?monthLabel(addMonths(sel,-24))+' \u2192 '+monthLabel(sel)+' (25 months, fixed 2-yr trailing)':'')+'</span></div>'+
    '<div class="section-tabs">'+sectionTabs+'</div>'+
    (state.section==='overview' ? '<div class="chart-grid">'+body+'</div>' : body) +
  '</div>';
}

/* ---------- Rendering: Admin tab ---------- */
function renderAdmin(){
  const canWrite = true; // gated server-side by the admin secret (see submitAdmin)
  const outlet = state.adminOutlet;
  const month = state.adminMonth || addMonths(latestMonthWithData(outlet) || '2026-08', 1);
  const existing = getRec(outlet, month);

  let outletOpts = OUTLETS.map(o=>'<option value="'+o.code+'" '+(o.code===outlet?'selected':'')+'>'+o.name+'</option>').join('');

  let groups = {};
  ADMIN_FIELDS.forEach(f=>{ (groups[f.group]=groups[f.group]||[]).push(f); });
  let fieldsHtml = Object.keys(groups).map(g=>{
    return '<fieldset><legend>'+g+'</legend>'+groups[g].map(f=>{
      const v = existing ? existing[f.k] : '';
      return '<label class="field"><span>'+f.l+'</span><input type="number" step="any" data-field="'+f.k+'" value="'+(v!=null?v:'')+'"/></label>';
    }).join('')+'</fieldset>';
  }).join('');

  const banner = !canWrite ? '<div class="banner warn">You have read-only access \u2014 ask an editor/contributor for write access to submit data.</div>' :
    existing ? '<div class="banner edit">Data for '+outlet+' / '+month+' already exists. Submitting will <b>overwrite</b> that month\'s record (an explicit edit) \u2014 all other months are untouched.</div>' :
    '<div class="banner new">New month \u2014 this will create a new record. No existing months are affected.</div>';

  return '<div class="panel">'+
    banner+
    '<div class="controls-row">'+
      '<label>Outlet <select id="adminOutlet">'+outletOpts+'</select></label>'+
      '<label>Month <input type="month" id="adminMonth" value="'+month+'"/></label>'+
    '</div>'+
    '<form id="adminForm">'+fieldsHtml+
      '<div id="adminSummary" class="summary"></div>'+
      '<div id="adminErrors" class="errors"></div>'+
      '<button type="submit" class="submit-btn" '+(canWrite?'':'disabled')+'>'+(existing?'Save changes':'Submit month')+'</button>'+
    '</form>'+
  '</div>';
}

/* ---------- Admin computation & validation ---------- */
function readAdminForm(){
  const vals = {};
  document.querySelectorAll('#adminForm [data-field]').forEach(inp=>{
    const raw = inp.value.trim();
    vals[inp.dataset.field] = raw==='' ? null : parseFloat(raw);
  });
  return vals;
}
function computeDerived(vals){
  const rev_total = ['rev_food','rev_liquor','rev_otherbev','rev_othersales'].reduce((s,k)=>s+(vals[k]||0),0);
  const gp_total = ['gp_food','gp_liquor','gp_otherbev','gp_othersales'].reduce((s,k)=>s+(vals[k]||0),0);
  const avg_salary = vals.team_size ? vals.team_cost/vals.team_size : null;
  const rev_per_cover = vals.covers ? rev_total/vals.covers : null;
  const gp_per_cover = vals.covers ? gp_total/vals.covers : null;
  return {rev_total, gp_total, avg_salary, rev_per_cover, gp_per_cover};
}
function validateAdmin(vals, derived){
  const errs = [];
  ADMIN_FIELDS.forEach(f=>{ if(vals[f.k]==null) errs.push('"'+f.l+'" is required.'); });
  if(vals.covers!=null && vals.covers<0) errs.push('Covers cannot be negative.');
  ['rev_food','rev_liquor','rev_otherbev','rev_othersales'].forEach(k=>{
    if(vals[k]!=null && vals[k]<0) errs.push('Revenue fields cannot be negative ('+k+').');
  });
  if(vals.team_cost!=null && vals.team_cost<0) errs.push('Team cost cannot be negative.');
  if(vals.team_size!=null && vals.team_size<=0) errs.push('Team size must be greater than 0.');
  if(derived.gp_total!=null && derived.rev_total!=null && derived.gp_total>derived.rev_total){
    errs.push('Warning: Gross Profit total exceeds Net Revenue total \u2014 double check the figures.');
  }
  return errs;
}
function updateAdminSummary(){
  const vals = readAdminForm();
  const derived = computeDerived(vals);
  const el = document.getElementById('adminSummary');
  if(el) el.innerHTML = '<div>Total Net Revenue: <b>'+fmtNum(derived.rev_total,'currency')+'</b></div>'+
    '<div>Total Gross Profit: <b>'+fmtNum(derived.gp_total,'currency')+'</b></div>'+
    '<div>Avg Net Salary/Person: <b>'+fmtNum(derived.avg_salary,'currency')+'</b></div>'+
    '<div>Net Revenue/Cover: <b>'+fmtNum(derived.rev_per_cover,'currency')+'</b></div>'+
    '<div>Gross Profit/Cover: <b>'+fmtNum(derived.gp_per_cover,'currency')+'</b></div>';
}
async function submitAdmin(e){
  e.preventDefault();
  const outlet = state.adminOutlet, month = state.adminMonth;
  const vals = readAdminForm();
  const derived = computeDerived(vals);
  const errs = validateAdmin(vals, derived);
  const errEl = document.getElementById('adminErrors');
  const hardErrs = errs.filter(x=>!x.startsWith('Warning'));
  if(hardErrs.length){
    errEl.innerHTML = errs.map(x=>'<div>\u2022 '+x+'</div>').join('');
    return;
  }
  let secret = localStorage.getItem('rmf_admin_secret') || '';
  if(!secret){
    secret = prompt('Enter the admin code to save this month:') || '';
    if(!secret) return;
  }
  const doc = Object.assign({outlet, month}, vals, derived);
  try{
    const res = await fetch('/api/months', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-admin-secret':secret},
      body: JSON.stringify(doc)
    });
    if(res.status===401){
      localStorage.removeItem('rmf_admin_secret');
      errEl.innerHTML = '<div>Incorrect admin code \u2014 try again.</div>';
      return;
    }
    if(!res.ok){
      const body = await res.json().catch(()=>({}));
      errEl.innerHTML = '<div>Save failed: '+(body.error||res.statusText)+'</div>';
      return;
    }
    localStorage.setItem('rmf_admin_secret', secret);
    allDocs[outlet+'_'+month] = doc;
    errEl.innerHTML = errs.length ? errs.map(x=>'<div>\u2022 '+x+'</div>').join('') : '';
    state.month = month; state.outlet = outlet;
    render();
    const banner = document.querySelector('.banner');
    if(banner){ banner.textContent = 'Saved '+monthLabel(month)+' for '+outlet+'.'; banner.className='banner ok'; }
  }catch(err){
    errEl.innerHTML = '<div>Save failed: '+(err && err.message ? err.message : 'network error')+'</div>';
  }
}

/* ---------- Tab shell & wiring ---------- */
function render(){
  const app = document.getElementById('app');
  const navTabs = ['dashboard','admin'].map(t=>
    '<button class="tab navtab '+(state.tab===t?'active':'')+'" data-tab="'+t+'">'+
    (t==='dashboard'?'Dashboard':'Admin: Add / Edit Month')+'</button>').join('');
  const outletNav = state.tab==='dashboard'
    ? '<div class="sidebar-group-label">Outlet</div>'+
      OUTLETS.map(o=>'<button class="pill sidebar-pill '+(o.code===state.outlet?'active':'')+'" data-outlet="'+o.code+'">'+o.name+'</button>').join('')
    : '';
  const body = state.tab==='dashboard'?renderDashboard(): renderAdmin();
  app.innerHTML = '<div class="layout">'+
    '<div class="sidebar"><div class="sidebar-group-label">View</div>'+navTabs+outletNav+'</div>'+
    '<div class="main">'+body+'</div>'+
  '</div>';
  wire();
}
function wire(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ state.tab=b.dataset.tab; render(); });
  document.querySelectorAll('[data-outlet]').forEach(b=>b.onclick=()=>{ state.outlet=b.dataset.outlet; state.month=null; state.section='overview'; render(); });
  document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{ state.section=b.dataset.section; render(); });
  const ms = document.getElementById('monthSelect');
  if(ms) ms.onchange = ()=>{ state.month = ms.value; render(); };

  const aOutlet = document.getElementById('adminOutlet');
  if(aOutlet) aOutlet.onchange = ()=>{ state.adminOutlet = aOutlet.value; state.adminMonth=null; render(); };
  const aMonth = document.getElementById('adminMonth');
  if(aMonth){ state.adminMonth = aMonth.value; aMonth.onchange = ()=>{ state.adminMonth = aMonth.value; render(); }; }
  const form = document.getElementById('adminForm');
  if(form){ form.onsubmit = submitAdmin; form.addEventListener('input', updateAdminSummary); updateAdminSummary(); }
}

/* ---------- Boot: load data from the API ---------- */
async function boot(){
  try{
    const [monthsRes, extraRes] = await Promise.all([
      fetch('/api/months'),
      fetch('/data/extra.json')
    ]);
    if(monthsRes.ok){
      const rows = await monthsRes.json();
      rows.forEach(r => { allDocs[r.outlet+'_'+r.month] = r; });
    } else {
      console.error('Failed to load /api/months:', monthsRes.status);
    }
    if(extraRes.ok){
      EXTRA_DATA = await extraRes.json();
    } else {
      console.error('Failed to load /data/extra.json:', extraRes.status);
    }
  }catch(e){
    console.error('Failed to load dashboard data:', e);
  }
  render();
}
document.addEventListener('DOMContentLoaded', boot);
