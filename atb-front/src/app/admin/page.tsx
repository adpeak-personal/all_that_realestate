'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi, type CollectStatus, type SiteSettings } from './AdminApi';
import AdminGate from './AdminGate';

/** 숫자 + 설명 한 칸. */
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400 tabular-nums">{sub}</p>}
    </div>
  );
}

function when(iso: string | null): string {
  if (!iso) return '기록 없음';
  const d = new Date(iso);
  const hours = (Date.now() - d.getTime()) / 36e5;
  const stamp = `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
  // 하루가 넘었으면 수집이 멈춘 것일 수 있어 눈에 띄게 적는다
  return hours > 26 ? `${stamp} (${Math.floor(hours / 24)}일 전)` : stamp;
}

function Dashboard() {
  const [status, setStatus] = useState<CollectStatus | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    Promise.all([adminApi.status(), adminApi.settings()])
      .then(([s, cfg]) => {
        setStatus(s);
        setSettings(cfg);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const toggleMap = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      setSettings(await adminApi.saveSettings({ mapEnabled: !settings.mapEnabled }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!status || !settings) return <p className="text-sm text-slate-500">불러오는 중…</p>;

  const k = status.kapt;
  const a = status.apartments;

  return (
    <div className="space-y-6">
      {/* 운영 스위치 */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-900">지도 · 거리뷰 표시</h2>
            <p className="mt-1 text-sm text-slate-500">
              끄면 단지 상세와 단지 찾기에서 지도가 사라지고 네이버 호출도 멈춥니다.
              무료 한도(월 600만 건)가 위험할 때 쓰세요. 반영까지 최대 30초 걸립니다.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleMap}
            disabled={saving}
            aria-pressed={settings.mapEnabled}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${
              settings.mapEnabled
                ? 'bg-brand-600 text-white hover:bg-brand-700'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            {settings.mapEnabled ? '켜짐' : '꺼짐'}
          </button>
        </div>
      </section>

      {/* 수집 상태 */}
      <section>
        <h2 className="font-bold text-slate-900 mb-3">수집 상태</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="실거래"
            value={status.deals.total.toLocaleString()}
            sub={status.deals.lastMonth ? `최신 ${status.deals.lastMonth.slice(0, 4)}.${status.deals.lastMonth.slice(4)}` : undefined}
          />
          <Stat
            label="단지"
            value={a.total.toLocaleString()}
            sub={`좌표 ${a.geocoded.toLocaleString()} · K-apt ${a.kaptMatched.toLocaleString()}`}
          />
          <Stat
            label="K-apt 마스터"
            value={k.total.toLocaleString()}
            sub={`시군구 ${k.sggDone}/${k.sggTotal} · ${when(k.lastSynced)}`}
          />
          <Stat
            label="분양 공고"
            value={status.presale.total.toLocaleString()}
            sub={`접수중 ${status.presale.open} · 예정 ${status.presale.upcoming} · ${when(status.presale.lastSynced)}`}
          />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          수집은 매일 자동 실행됩니다 (09:00 K-apt · 04:00 좌표 · 06:00 분양).
          날짜가 하루 이상 밀려 있으면 PC가 꺼져 있었거나 수집이 멈춘 것입니다.
        </p>
      </section>
    </div>
  );
}

export default function AdminHome() {
  return (
    <AdminGate>
      <Dashboard />
    </AdminGate>
  );
}
