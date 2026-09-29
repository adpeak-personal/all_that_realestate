'use client';

import { useState } from 'react';
import type { LandingBlock } from '../../AdminApi';

/**
 * 분양 랜딩 편집기.
 *
 * 블록을 쌓고 순서를 바꾸는 화면이다. 배열 순서가 곧 페이지에 나오는 순서다.
 *
 * 순서 바꾸기는 두 가지로 둔다:
 *  - 드래그 (마우스로 빠르게)
 *  - ↑↓ 버튼 (드래그가 안 되는 상황 — 모바일, 터치패드, 블록이 길어 화면 밖으로 나갈 때)
 * 드래그만 두면 긴 목록에서 20번째를 1번으로 옮기기가 지옥이 된다.
 *
 * 이미지는 지금 '주소로 불러오기' 만 된다. 파일 업로드는 저장할 곳(서버)이 정해지면
 * 붙인다 — 그 전까지 버튼만 만들어 두면 눌러도 아무 일이 없어 고장처럼 보인다.
 */
export default function LandingEditor({
  value,
  onChange,
}: {
  value: LandingBlock[];
  onChange: (next: LandingBlock[]) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  const newId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const add = (type: LandingBlock['type']) => {
    const block: LandingBlock =
      type === 'image'
        ? { id: newId(), type: 'image', url: '', alt: '', link: null }
        : { id: newId(), type: 'text', heading: '', body: '' };
    onChange([...value, block]);
  };

  const patch = (id: string, change: Partial<LandingBlock>) =>
    onChange(value.map((b) => (b.id === id ? ({ ...b, ...change } as LandingBlock) : b)));

  const remove = (id: string) => onChange(value.filter((b) => b.id !== id));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          아직 블록이 없습니다. 아래에서 추가하세요.
        </p>
      )}

      {value.map((b, i) => (
        <div
          key={b.id}
          draggable
          onDragStart={() => setDragId(b.id)}
          onDragEnd={() => setDragId(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const from = value.findIndex((x) => x.id === dragId);
            if (from >= 0) move(from, i);
            setDragId(null);
          }}
          className={`rounded-xl border bg-white p-3 ${
            dragId === b.id ? 'border-brand-500 opacity-60' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="cursor-grab select-none text-slate-400" title="끌어서 순서 변경">
              ⠿
            </span>
            <span className="text-xs font-bold text-slate-500">
              {i + 1}. {b.type === 'image' ? '이미지' : '글'}
            </span>

            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                className="rounded border border-slate-200 px-2 py-0.5 text-xs disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === value.length - 1}
                className="rounded border border-slate-200 px-2 py-0.5 text-xs disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(b.id)}
                className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                삭제
              </button>
            </span>
          </div>

          {b.type === 'image' ? (
            <div className="mt-2 space-y-2">
              <input
                value={b.url}
                onChange={(e) => patch(b.id, { url: e.target.value })}
                placeholder="이미지 주소 (https://…) — 회사 사이트 이미지 주소를 그대로 붙여넣으세요"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  value={b.alt}
                  onChange={(e) => patch(b.id, { alt: e.target.value })}
                  placeholder="이미지 설명 (검색·접근성용)"
                  className="flex-1 min-w-[160px] rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={b.link ?? ''}
                  onChange={(e) => patch(b.id, { link: e.target.value || null })}
                  placeholder="클릭 시 이동할 주소 (선택)"
                  className="flex-1 min-w-[160px] rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {b.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.url}
                  alt={b.alt || '미리보기'}
                  className="max-h-48 rounded-md border border-slate-200 object-contain"
                />
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <input
                value={b.heading}
                onChange={(e) => patch(b.id, { heading: e.target.value })}
                placeholder="소제목 (선택)"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
              />
              <textarea
                value={b.body}
                onChange={(e) => patch(b.id, { body: e.target.value })}
                rows={5}
                placeholder="내용. 줄바꿈은 그대로 반영됩니다."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => add('image')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          + 이미지
        </button>
        <button
          type="button"
          onClick={() => add('text')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          + 글
        </button>
        <span className="text-xs text-slate-400">
          파일 업로드는 이미지 저장소가 정해지면 붙입니다. 지금은 주소로 불러오세요.
        </span>
      </div>
    </div>
  );
}
