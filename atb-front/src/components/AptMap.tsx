'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadNaverMaps, NAVER_MAP_KEY_ID } from '../lib/naver-maps';
import { useInView } from '../lib/use-in-view';

/**
 * 단지 위치 지도 + 거리뷰 (네이버 지도 JS v3).
 *
 * 지도 업체를 바꾸더라도 이 파일 하나만 고치면 되도록, 바깥에는 위경도와 이름만
 * 받는 형태로 둔다. 좌표는 행정안전부 주소정보누리집에서 받아 우리 DB 에 저장한
 * 값이다 — 지도 업체의 지오코딩 결과가 아니므로 저장·표시에 제약이 없다.
 *
 * 거리뷰는 화면에 띄우는 것만 허용된다. 캡처해서 썸네일·공유 이미지로 저장하면
 * 약관 위반이므로 그렇게 쓰지 않는다.
 *
 * 스크립트는 한 번만 불러온다. 단지 사이를 이동할 때마다 <script> 를 새로 붙이면
 * naver 전역이 다시 초기화되며 지도가 깜빡인다.
 */
type View = 'map' | 'pano';

export default function AptMap({
  lat,
  lng,
  name,
  zoom = 16,
}: {
  lat: number;
  lng: number;
  name: string;
  zoom?: number;
}) {
  // 지도가 화면 가까이 왔을 때만 불러온다 (네이버 무료 한도 절약)
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();
  const mapBox = useRef<HTMLDivElement | null>(null);
  const panoBox = useRef<HTMLDivElement | null>(null);
  const panoMade = useRef(false);

  const [view, setView] = useState<View>('map');
  const [error, setError] = useState<string | null>(null);
  // null = 아직 모름, true = 거리뷰 있음, false = 이 좌표 주변에 거리뷰 없음
  const [hasPano, setHasPano] = useState<boolean | null>(null);

  useEffect(() => {
    if (!NAVER_MAP_KEY_ID || !inView) return;
    let cancelled = false;

    loadNaverMaps()
      .then(() => {
        if (cancelled || !mapBox.current || !window.naver?.maps) return;
        const { maps } = window.naver;
        const center = new maps.LatLng(lat, lng);
        const map = new maps.Map(mapBox.current, {
          center,
          zoom,
          scrollWheel: true,   // 휠 확대 (사용자 요청)
          zoomControl: true,
          zoomControlOptions: {
            style: maps.ZoomControlStyle.SMALL,
            position: maps.Position.TOP_RIGHT,
          },
        });
        new maps.Marker({ position: center, map, title: name });
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, name, zoom, inView]);

  /** 거리뷰는 처음 누를 때 만든다. 안 보는 사람에게 파노라마를 미리 받게 할 이유가 없다. */
  const showPano = useCallback(() => {
    setView('pano');
    if (panoMade.current || !panoBox.current || !window.naver?.maps?.Panorama) return;
    panoMade.current = true;

    const { maps } = window.naver;
    const box = panoBox.current;
    const pano = new maps.Panorama(box, {
      position: new maps.LatLng(lat, lng),
      pov: { pan: 0, tilt: 0, fov: 100 },
      size: new maps.Size(box.clientWidth, box.clientHeight),
    }) as { setSize?: (s: unknown) => void };

    // 생성 시점의 크기를 그대로 쓰므로, 레이아웃이 잡힌 다음 한 번 더 맞춘다.
    // (예전에 display:none 상태에서 만들어 100px 짜리로 붙은 적이 있다)
    requestAnimationFrame(() => {
      pano.setSize?.(new maps.Size(box.clientWidth, box.clientHeight));
    });
    // 주변에 거리뷰가 없으면 ERROR 로 온다 (단지 안쪽·신축은 없는 곳이 많다)
    maps.Event.addListener(pano as object, 'pano_status', (...args: unknown[]) => {
      setHasPano(args[0] === 'OK');
    });
  }, [lat, lng]);

  const message = !NAVER_MAP_KEY_ID ? '지도 키가 설정되지 않았습니다' : error;
  if (message) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 text-sm text-slate-400">
        {message}
      </div>
    );
  }

  // 안 보이는 쪽을 display:none 으로 두면 크기가 0 이 되어 지도·거리뷰가 찌그러진다.
  // 둘 다 자리를 차지한 채로 겹쳐 두고 visibility 로만 감춘다.
  const layer = (on: boolean) =>
    `absolute inset-0 ${on ? '' : 'invisible pointer-events-none'}`;

  return (
    <div ref={viewRef} className="relative h-full w-full">
      {/*
        지도·거리뷰 요소에 직접 위치를 주면 안 된다. 네이버가 그 요소의 style 에
        position: relative 를 인라인으로 박아 넣어서 우리 absolute 가 무시되고,
        레이어 높이가 0 이 된다. 위치를 잡는 껍데기를 한 겹 두고, 안쪽을 넘긴다.
      */}
      <div className={layer(view === 'map')}>
        <div ref={mapBox} className="h-full w-full" />
      </div>

      <div className={layer(view === 'pano')}>
        <div ref={panoBox} className="h-full w-full" />
        {hasPano === false && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 px-6 text-center text-sm text-slate-500">
            이 단지 주변에는 거리뷰가 없습니다.
          </div>
        )}
      </div>

      {/* 전환 버튼. 거리뷰가 없는 것으로 확인되면 다시 누를 수 없게 감춘다. */}
      <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setView('map')}
          aria-pressed={view === 'map'}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === 'map' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          지도
        </button>
        {hasPano !== false && (
          <button
            type="button"
            onClick={showPano}
            aria-pressed={view === 'pano'}
            className={`border-l border-slate-300 px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === 'pano' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            거리뷰
          </button>
        )}
      </div>
    </div>
  );
}
