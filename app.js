'use strict';
(()=>{
 const C=window.KPICore,$=id=>document.getElementById(id);
 let rows=C.SAMPLE.map((r,i)=>({...r,id:'sample-'+i})),options={};
 const fmt=v=>BigInt(v).toLocaleString('ko-KR');
 function selectOptions(id,values){const el=$(id),selected=el.value;el.replaceChildren(new Option('전체',''));[...new Set(values)].sort().forEach(v=>el.add(new Option(v,v)));if([...el.options].some(o=>o.value===selected))el.value=selected;}
 function draw(){
  const data=rows.filter(r=>(!$('filter-month').value||r.month===$('filter-month').value)&&(!$('filter-team').value||r.team===$('filter-team').value)&&(!$('filter-user').value||r.user_id===$('filter-user').value));
  const total=C.summarize(data);$('total-target').textContent=fmt(total.target)+'원';$('total-actual').textContent=fmt(total.actual)+'원';$('total-rate').textContent=total.rate;$('total-count').textContent=total.count+'건';
  $('rows').replaceChildren();$('chart').replaceChildren();
  $('empty').hidden=!!data.length;
  $('owner-head').hidden=!options.showOwner;$('action-head').hidden=!options.editable;
  for(const r of data){const tr=document.createElement('tr');
   const cells=[r.month,r.team,fmt(r.target),fmt(r.actual),C.summarize([r]).rate];
   if(options.showOwner)cells.push(r.user_id||'샘플');
   for(const value of cells){const td=document.createElement('td');td.textContent=value;tr.append(td);}
   if(options.editable){const td=document.createElement('td');for(const [label,handler] of [['수정',options.onEdit],['삭제',options.onDelete]]){const b=document.createElement('button');b.textContent=label;b.type='button';b.disabled=!!options.busy;b.onclick=()=>handler?.(r);td.append(b);}tr.append(td);}
   $('rows').append(tr);
  }
  for(const team of [...new Set(data.map(r=>r.team))]){
   const summary=C.summarize(data.filter(r=>r.team===team)),bar=document.createElement('div');bar.className='barrow';
   const label=document.createElement('span');label.textContent=team;
   const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='fill';
   fill.style.width=(summary.rate==='목표 미설정'?0:Math.min(100,Number(summary.rate.slice(0,-1))))+'%';track.append(fill);
   const rate=document.createElement('span');rate.textContent=summary.rate;bar.append(label,track,rate);$('chart').append(bar);
  }
 }
 function setRows(next,opts={}){rows=next;options=opts;selectOptions('filter-month',rows.map(r=>r.month));selectOptions('filter-team',rows.map(r=>r.team));selectOptions('filter-user',rows.map(r=>r.user_id||'샘플'));$('user-filter-label').hidden=!options.showOwner;draw();}
 for(const id of ['filter-month','filter-team','filter-user'])$(id).onchange=draw;
 $('filter-reset').onclick=()=>{for(const id of ['filter-month','filter-team','filter-user'])$(id).value='';draw();};
 window.KPIDashboard={setRows,draw};setRows(rows);
})();
