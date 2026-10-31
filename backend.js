/* Supabase boundary. No table calls are made until the user chooses DB mode. */
(function (root) {
  'use strict';
  function createBackend(config, core) {
    let client = null;
    function configured() {
      return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config?.supabaseUrl || '')
        && /^sb_publishable_[A-Za-z0-9_-]+$/.test(config?.supabasePublishableKey || '');
    }
    async function connect() {
      if (!configured()) throw new Error('미설정: config.js에 Supabase Project URL과 publishable key를 입력하세요.');
      if (!root.supabase?.createClient) throw new Error('Supabase 라이브러리를 불러오지 못했습니다. vendor/supabase.js를 확인하세요.');
      if (!client) client = root.supabase.createClient(config.supabaseUrl.replace(/\/$/, ''), config.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error('Supabase 세션 확인 실패: ' + error.message);
      return data.session;
    }
    function onAuthStateChange(callback) {
      if (!client) throw new Error('Supabase에 먼저 연결하세요.');
      const { data } = client.auth.onAuthStateChange(callback);
      return () => data.subscription.unsubscribe();
    }
    async function signIn(email, password) {
      if (!client) throw new Error('Supabase에 먼저 연결하세요.');
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error('로그인 실패: 이메일·비밀번호와 앱 사용자 계정 상태를 확인하세요.');
      return data.session;
    }
    async function signOut() {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw new Error('로그아웃에 실패했습니다. 다시 시도하세요.');
    }
    async function listMine(userId) {
      if (!client || !userId) throw new Error('로그인한 앱 사용자가 필요합니다.');
      const result = [];
      const pageSize = 500;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await client.from('kpi_records')
          .select('id,user_id,month,team,target,actual')
          .eq('user_id', userId)
          .order('month', { ascending: false })
          .order('team', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw new Error('본인 KPI 조회 실패: ' + (error.message || '테이블·권한·RLS 설정을 확인하세요.'));
        for (const row of data || []) {
          if (row.user_id !== userId || !row.id) throw new Error('조회 결과의 소유자 또는 행 ID가 올바르지 않습니다.');
          result.push({ ...core.validateRecord(row), id: row.id, user_id: row.user_id });
        }
        if (!data || data.length < pageSize) return result;
        if (result.length >= 100000) throw new Error('조회 건수가 안전 한도를 넘었습니다. 전체 합계를 표시하지 않습니다.');
      }
    }
    async function saveMine(userId, input) {
      if (!client || !userId) throw new Error('로그인한 앱 사용자가 필요합니다.');
      const record = core.validateRecord(input);
      const { data, error } = await client.from('kpi_records')
        .insert({ ...record, user_id: userId })
        .select('id,user_id,month,team,target,actual')
        .single();
      if (error) {
        if (error.code === '23505') throw new Error('중복된 KPI입니다. 같은 사용자·월·부서는 한 건만 저장할 수 있습니다.');
        if (error.code === '42501') throw new Error('저장이 거부되었습니다. 로그인 사용자와 RLS 정책을 확인하세요.');
        throw new Error('DB 저장 실패: ' + (error.message || '테이블·권한·RLS 설정을 확인하세요.'));
      }
      if (!data || data.user_id !== userId || !data.id) throw new Error('저장 결과를 확인하지 못했습니다. DB와 RLS를 확인하세요.');
      return { ...core.validateRecord(data), id: data.id, user_id: data.user_id };
    }
    return { configured, connect, onAuthStateChange, signIn, signOut, listMine, saveMine };
  }
  root.KPIBackend = { createBackend };
})(window);
