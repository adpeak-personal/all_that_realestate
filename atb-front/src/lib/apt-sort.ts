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

/**
 * 주택 유형 탭. value 가 빈 문자열이면 '전체'(유형을 가리지 않음).
 * 서버에서 화이트리스트로 한 번 더 거르므로 여기 값이 그대로 SQL 로 가지는 않는다.
 */
export const PROPERTY_TABS: Array<{ value: string; label: string }> = [
  { value: '', label: '전체' },
  { value: 'APT', label: '아파트' },
  { value: 'OFFI', label: '오피스텔' },
];

/** 유형 코드 → 이름. 모르는 값은 '아파트' 로 본다 (예전 데이터는 전부 아파트다). */
export const PROPERTY_LABEL: Record<string, string> = { APT: '아파트', OFFI: '오피스텔' };

export const SIDO_LIST = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];
