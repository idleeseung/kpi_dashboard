'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const core = window.KPICore;
  const backend = window.KPIBackend.createBackend(window.KPI_CONFIG, core);
  const sampleRows = core.SAMPLE.map((row, index) => ({ ...row, id: `sample-${index}` }));
  let rows = sampleRows;
  let mode = 'sample';
  let user = null;
  let busy = false;
  let unsubscribe = null;
  let authGeneration = 0;
  let loadTask = Promise.resolve();
  const money = value => `${BigInt(value).toLocaleString('ko-KR')}원`;

  function status(text, isError = false) {
    const box = $('connection-message');
    box.textContent = text;
    box.classList.toggle('error', isError);
  }
  function draw() {
    window.KPIDashboard.setRows(rows);
    $('mode-label').textContent = mode === 'sample' ? '샘플 모드 · DB 미연결' : user ? 'DB 모드 · 본인 자료' : 'DB 모드 · 로그인 필요';
    $('mode-detail').textContent = mode === 'sample'
      ? '가상 6건입니다. 새로고침하면 초기 상태로 돌아갑니다.'
      : user ? 'DB에서 로그인한 본인 자료만 표시합니다.' : '준비한 앱 사용자 계정으로 로그인하세요.';
    $('account').textContent = user ? `로그인: ${user.email || '앱 사용자'}` : '로그아웃 상태';
    $('connect-db').hidden = mode === 'db';
    $('sample-mode').hidden = mode === 'sample';
    $('connect-db').disabled = busy;
    $('sample-mode').disabled = busy;
    $('login-form').hidden = mode !== 'db' || !!user;
    $('record-form').hidden = mode !== 'db' || !user;
    $('logout').hidden = mode !== 'db' || !user;
    $('auth-panel').querySelectorAll('input, button').forEach(element => {
      if (element.id === 'connect-db' || element.id === 'sample-mode') return;
      element.disabled = busy;
    });
    $('record-form').querySelectorAll('input, button').forEach(element => { element.disabled = busy; });
    $('login-form').querySelectorAll('input, button').forEach(element => { element.disabled = busy; });
  }
  async function refreshRows(quiet = false) {
    if (!user || mode !== 'db') return false;
    const token = authGeneration;
    if (!quiet) status('Supabase에서 본인 KPI를 조회하고 있습니다.');
    try {
      const next = await backend.listMine(user.id);
      if (token !== authGeneration || mode !== 'db') return false;
      rows = next;
      draw();
      if (!quiet) status(`본인 자료 ${rows.length}건을 조회했습니다.`);
      return true;
    } catch (error) {
      if (token !== authGeneration || mode !== 'db') return false;
      rows = [];
      draw();
      status(error.message || '조회 실패. 테이블과 RLS 설정을 확인하세요.', true);
      return false;
    }
  }
  function adoptSession(session) {
    const nextUser = session?.user || null;
    if ((user?.id || null) === (nextUser?.id || null)) {
      user = nextUser;
      draw();
      return loadTask;
    }
    authGeneration++;
    user = nextUser;
    rows = [];
    $('record-form').reset();
    $('password').value = '';
    draw();
    loadTask = user ? refreshRows() : Promise.resolve(false);
    return loadTask;
  }
  async function connectDb() {
    busy = true; mode = 'db'; user = null; rows = []; authGeneration++;
    draw(); status('Supabase 연결 설정을 확인하고 있습니다.');
    try {
      const session = await backend.connect();
      if (!unsubscribe) unsubscribe = backend.onAuthStateChange((event, nextSession) => {
        if (mode !== 'db' || event === 'INITIAL_SESSION') return;
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          void adoptSession(nextSession);
        }
      });
      await adoptSession(session);
      if (!session?.user) status('연결되었습니다. 앱 사용자로 로그인하세요.');
    } catch (error) {
      mode = 'sample'; user = null; rows = sampleRows; authGeneration++;
      draw(); status(error.message || 'Supabase 연결에 실패했습니다.', true);
    } finally { busy = false; draw(); }
  }
  async function run(action) {
    if (busy) return;
    busy = true; draw();
    try { await action(); }
    catch (error) { status(error.message || '요청에 실패했습니다.', true); }
    finally { busy = false; draw(); }
  }

  $('connect-db').addEventListener('click', () => { void connectDb(); });
  $('sample-mode').addEventListener('click', () => {
    if (busy) return;
    mode = 'sample'; user = null; rows = sampleRows; authGeneration++;
    $('record-form').reset(); draw();
    status('가상 샘플을 표시합니다. DB에는 저장하지 않습니다.');
  });
  $('login-form').addEventListener('submit', event => {
    event.preventDefault();
    void run(async () => {
      if (mode !== 'db') await connectDb();
      if (mode !== 'db') throw new Error('DB 연결을 확인한 뒤 다시 시도하세요.');
      let session;
      try { session = await backend.signIn($('email').value.trim(), $('password').value); }
      finally { $('password').value = ''; }
      await adoptSession(session);
    });
  });
  $('logout').addEventListener('click', () => {
    void run(async () => {
      await backend.signOut();
      await adoptSession(null);
      status('로그아웃했습니다. 본인 자료를 화면에서 비웠습니다.');
    });
  });
  $('record-form').addEventListener('submit', event => {
    event.preventDefault();
    void run(async () => {
      if (mode !== 'db' || !user) throw new Error('DB 모드에서 로그인해야 저장할 수 있습니다.');
      const record = core.validateRecord({
        month: $('record-month').value,
        team: $('record-team').value,
        target: $('record-target').value,
        actual: $('record-actual').value
      });
      await backend.saveMine(user.id, record);
      $('record-form').reset();
      $('filter-month').value = ''; $('filter-team').value = '';
      const loaded = await refreshRows(true);
      if (loaded) status('저장 완료. DB에서 다시 읽은 값을 표시합니다. 새로고침 후에도 재조회할 수 있습니다.');
      else status('저장은 성공했지만 재조회에 실패했습니다. 다시 불러오기를 새로고침으로 시도하세요.', true);
    });
  });
  for (const id of ['filter-month', 'filter-team']) $(id).addEventListener('change', () => window.KPIDashboard.draw());
  $('filter-reset').addEventListener('click', () => {
    $('filter-month').value = ''; $('filter-team').value = ''; window.KPIDashboard.draw();
  });

  draw();
  if (backend.configured()) void connectDb();
  else status('미설정: config.js에 Supabase Project URL과 publishable key를 입력하면 DB 로그인을 사용할 수 있습니다. 샘플은 DB에 저장하지 않습니다.', true);
})();
