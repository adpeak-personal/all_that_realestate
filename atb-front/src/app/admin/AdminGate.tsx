'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from './AdminApi';

/**
 * 로그인 문지기. 관리 화면을 이걸로 감싼다.
 *
 * 진짜 방어는 서버가 한다 — 여기서 막는 건 화면일 뿐이고, 모든 관리 API 는
 * 쿠키를 검사한다. 이 컴포넌트는 "로그인 안 된 사람에게 빈 화면 대신 로그인 창을
 * 보여주는" 역할이다.
 */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(() => {
    adminApi
      .me()
      .then((r) => setState(r.admin ? 'in' : 'out'))
      .catch(() => setState('out'));
  }, []);

  useEffect(check, [check]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(password);
      setPassword('');
      setState('in');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await adminApi.logout().catch(() => {});
    setState('out');
  };

  if (state === 'checking') {
    return <p className="text-sm text-slate-500">확인 중…</p>;
  }

  if (state === 'out') {
    return (
      <form
        onSubmit={submit}
        className="mx-auto max-w-sm bg-white rounded-xl border border-slate-200 p-6"
      >
        <h1 className="text-lg font-bold text-slate-900">관리자 로그인</h1>
        <p className="mt-1 text-sm text-slate-500">관리자 비밀번호를 입력하세요.</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          placeholder="비밀번호"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={signOut}
          className="text-xs text-slate-500 hover:text-slate-900 hover:underline"
        >
          로그아웃
        </button>
      </div>
      {children}
    </div>
  );
}
