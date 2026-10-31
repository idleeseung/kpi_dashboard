'use strict';
(() => {
  const core = window.KPICore;
  const $ = id => document.getElementById(id);
  let rows = core.SAMPLE.map((row, index) => ({ ...row, id: `sample-${index}` }));
  let options = {};
  const format = value => BigInt(value).toLocaleString('ko-KR');

  function setSelectOptions(id, values) {
    const select = $(id), previous = select.value;
    select.replaceChildren(new Option('전체', ''));
    [...new Set(values)].sort().forEach(value => select.add(new Option(value, value)));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
  function draw() {
    const data = rows.filter(row =>
      (!$('filter-month').value || row.month === $('filter-month').value)
      && (!$('filter-team').value || row.team === $('filter-team').value)
      && (!$('filter-user').value || row.user_id === $('filter-user').value));
    const total = core.summarize(data);
    $('total-target').textContent = format(total.target) + '원';
    $('total-actual').textContent = format(total.actual) + '원';
    $('total-rate').textContent = total.rate;
    $('total-count').textContent = total.count + '건';
    $('rows').replaceChildren();
    $('chart').replaceChildren();
    $('empty').hidden = !!data.length;
    $('owner-head').hidden = !options.showOwner;
    $('action-head').hidden = !options.editable;

    for (const row of data) {
      const tr = document.createElement('tr');
      const cells = [row.month, row.team, format(row.target), format(row.actual), core.summarize([row]).rate];
      if (options.showOwner) cells.push(row.user_id || '샘플');
      for (const value of cells) {
        const td = document.createElement('td'); td.textContent = value; tr.append(td);
      }
      if (options.editable) {
        const td = document.createElement('td');
        for (const [label, handler] of [['수정', options.onEdit], ['삭제', options.onDelete]]) {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = label; button.disabled = !!options.busy;
          button.onclick = () => handler?.(row); td.append(button);
        }
        tr.append(td);
      }
      $('rows').append(tr);
    }
    for (const team of [...new Set(data.map(row => row.team))]) {
      const summary = core.summarize(data.filter(row => row.team === team));
      const bar = document.createElement('div'); bar.className = 'barrow';
      const label = document.createElement('span'); label.textContent = team;
      const track = document.createElement('div'); track.className = 'track';
      const fill = document.createElement('div'); fill.className = 'fill';
      fill.style.width = (summary.rate === '목표 미설정' ? 0 : Math.min(100, Number(summary.rate.slice(0, -1)))) + '%';
      track.append(fill);
      const rate = document.createElement('span'); rate.textContent = summary.rate;
      bar.append(label, track, rate); $('chart').append(bar);
    }
  }
  function setRows(next, nextOptions = {}) {
    rows = next; options = nextOptions;
    setSelectOptions('filter-month', rows.map(row => row.month));
    setSelectOptions('filter-team', rows.map(row => row.team));
    setSelectOptions('filter-user', rows.map(row => row.user_id || '샘플'));
    $('user-filter-label').hidden = !options.showOwner;
    draw();
  }
  window.KPIDashboard = { setRows, draw };
  setRows(rows);
})();
