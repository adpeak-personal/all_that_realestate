// 단지 목록의 정렬/지역 상수.
//
// 'use client' 모듈에서 export 한 값은 서버 컴포넌트로 넘어올 때 실제 값이
// 아니라 클라이언트 참조가 된다(컴포넌트만 경계를 넘는다). 서버·클라이언트가
// 함께 쓰는 상수는 이렇게 중립 모듈에 둔다.
import type { AptSort } from '../service/main/type';

export const SORT_LABELS: Array<{ value: AptSort; label: string }> = [
  { value: 'deals', label: '거래 많은순' },
  { value: 'price_desc', label: '㎡당 단가 높은순' },
  { value: 'price_asc', label: '㎡당 단가 낮은순' },
  { value: 'households', label: '세대수 많은순' },
  { value: 'recent', label: '최근 거래순' },
  { value: 'name', label: '가나다순' },
];

export const SIDO_LIST = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];
