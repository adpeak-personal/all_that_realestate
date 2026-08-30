"""K-apt 마스터 동기화 + 매칭 실행 (CLI).

실거래 수집(GUI)과 별개로 도는 워커. 순서:
  1) kapt_sync.sync_sigungu  → kapt_complexes 채움 (K-apt 목록+기본+상세)
  2) apt_match_run.run_matching → apartments 매칭 결과 기록

사용:
  python run_kapt.py 11650                # 서초구: 동기화 후 매칭
  python run_kapt.py 11650 11680 11710    # 여러 시군구
  python run_kapt.py 11650 --match-only   # 동기화 건너뛰고 매칭만
  python run_kapt.py 11650 --sync-only    # 매칭 없이 동기화만
  python run_kapt.py 11650 --resync       # 최신 캐시 무시하고 K-apt 전량 재동기화

기본: 최근 30일 내 동기화된 단지는 건너뜀(자주 눌러도 신규만 받음).

선행: MySQL 기동 + migrations/000_atb_db.sql 적용.
"""
from __future__ import annotations

import sys

from services import kapt_sync, apt_match_run


def _sync(sgg: str, max_age_days: int = 30):
    def prog(done, total, name):
        end = "\n" if done == total else "\r"
        print(f"  [동기화] {done}/{total}  {name[:24]:24}", end=end, flush=True)
    print(f"■ {sgg} K-apt 마스터 동기화...")
    st = kapt_sync.sync_sigungu(sgg, max_age_days=max_age_days, on_progress=prog)
    print(f"  → 단지 {st['total']} / 신규·갱신 {st['saved']} / 건너뜀(최신) "
          f"{st.get('skipped', 0)} / 실패 {st['errors']}")


def _match(sgg: str):
    print(f"■ {sgg} 매칭...")
    st = apt_match_run.run_matching(int(sgg))
    auto = st["confirmed"] + st["matched"]
    print(f"  → 대상 {st['total']} (마스터 {st['master']})")
    print(f"     자동확정 {auto}  (confirmed {st['confirmed']} / matched {st['matched']})")
    print(f"     수동확인 {st['ambiguous'] + st['conflict']}  "
          f"(ambiguous {st['ambiguous']} / conflict {st['conflict']})")
    print(f"     미매칭 {st['unmatched']}")


def main(argv: list[str]):
    args = [a for a in argv if not a.startswith("--")]
    flags = {a for a in argv if a.startswith("--")}
    if not args:
        print(__doc__)
        return 1

    max_age = 0 if "--resync" in flags else 30   # --resync: 전량 강제 재동기화
    for sgg in args:
        if "--match-only" not in flags:
            _sync(sgg, max_age_days=max_age)
        if "--sync-only" not in flags:
            _match(sgg)
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
