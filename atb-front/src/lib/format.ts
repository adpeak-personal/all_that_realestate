// 화면 표시용 포맷 유틸.

/** 만원 단위 금액 → '32억 6,000만'. 실거래 API 가 만원 단위로 주기 때문. */
export function formatPrice(manwon: number): string {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000);
    const rem = manwon % 10000;
    return rem === 0 ? `${eok}억` : `${eok}억 ${rem.toLocaleString()}만`;
  }
  return `${manwon.toLocaleString()}만`;
}

/** 'YYYYMM' → '2026년 7월'. 형식이 어긋나면 null. */
export function formatYearMonth(ym: string | null): string | null {
  if (!ym || !/^\d{6}$/.test(ym)) return null;
  return `${ym.slice(0, 4)}년 ${Number(ym.slice(4, 6))}월`;
}

/** 'YYYY-MM-DD' → '2026.07.31' */
export function formatDate(iso: string): string {
  return iso.replace(/-/g, '.');
}

/** ㎡ → 평 (1평 = 3.3058㎡). 소수 첫째자리. */
export function toPyeong(m2: number): string {
  return (m2 / 3.3058).toFixed(1);
}
