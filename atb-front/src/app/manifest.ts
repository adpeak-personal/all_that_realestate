import type { MetadataRoute } from 'next';

// PWA/안드로이드 홈화면용. maskable 은 원형·스쿼클 마스크에 잘려도 마크가
// 남도록 여백을 둔 별도 이미지다 (같은 이미지를 재활용하면 가장자리가 잘린다).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '올댓부동산 - 전국 아파트 실거래가·분양정보',
    short_name: '올댓부동산',
    description: '국토교통부 실거래가와 청약홈 분양정보를 한곳에서',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0B3B35',
    lang: 'ko',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
