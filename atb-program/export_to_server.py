"""로컬 DB 의 수집 결과를 서버로 옮길 SQL 을 만든다.

통째로 덮어쓰면 안 된다. 서버에는 로컬에 없는 것이 있다:
  - presale_notices.id     : 서버가 매긴 번호. 주소(/presale/125)에 쓰인다.
                             덮으면 이미 검색엔진에 올라간 주소가 전부 바뀐다.
  - seo_title / seo_description / landing : 어드민에서 손으로 쓴 값
  - is_featured / sort_weight / is_hidden : 광고 노출 설정

그래서 '수집이 채우는 칸' 만 갱신한다. 나머지는 서버 값을 그대로 둔다.

  python export_to_server.py            # deploy/dump/sync-*.sql 생성
  python export_to_server.py --check    # 만든 SQL 을 로컬에 다시 적용해 본다(무해해야 정상)

만든 파일을 서버로 올려 적용하는 방법은 출력 끝에 안내한다.
"""
from __future__ import annotations

import gzip
import sys
from pathlib import Path

from services import db

OUT = Path(__file__).resolve().parent.parent / 'deploy' / 'dump'

# 수집이 채우는 칸만. 여기 없는 칸은 서버 값을 건드리지 않는다.
APT_COLS = [
    # 아래 여섯은 수집으로 만들어지는 식별 정보다. 갱신에는 쓰이지 않지만
    # 서버에 없는 단지가 있을 때 새로 넣으려면 있어야 한다(NOT NULL).
    # property_type 은 유니크 키에도 들어가므로 빠지면 오피스텔이 아파트로 들어간다.
    'property_type', 'sgg_cd', 'umd_nm', 'jibun', 'apt_nm', 'build_year',
    'kapt_code', 'match_status', 'match_method', 'matched_at',
    'total_households', 'total_floors', 'address_road', 'address_jibun',
    'lat', 'lng', 'geocode_status', 'geocoded_at', 'exclu_areas',
]
NOTICE_COLS = [
    'source', 'house_nm', 'house_secd', 'house_secd_nm', 'house_dtl_secd_nm',
    'rent_secd_nm', 'subscrpt_area_nm', 'sido_nm', 'sgg_nm', 'sgg_cd', 'addr',
    'total_households', 'notice_date', 'rcept_bgnde', 'rcept_endde',
    'spsply_bgnde', 'spsply_endde', 'winner_date', 'contract_bgnde',
    'contract_endde', 'movein_ym', 'developer', 'builder', 'tel', 'homepage',
    'pblanc_url', 'speclt_rdn_earth_at', 'mdat_trget_area_at', 'parcprc_uls_at',
    'raw', 'synced_at',
]


def lit(v) -> str:
    """SQL 리터럴. 문자열은 이스케이프하고, 날짜/시간은 문자열로 넘긴다."""
    if v is None:
        return 'NULL'
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (bytes, bytearray)):
        v = v.decode('utf-8', 'replace')
    s = str(v)
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '') + "'"


def rows(sql: str):
    conn = db._conn()
    try:
        import pymysql
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(sql)
            while True:
                chunk = cur.fetchmany(2000)
                if not chunk:
                    break
                yield from chunk
    finally:
        conn.close()


def write_upsert(path: Path, table: str, key_cols: list[str], cols: list[str], select: str,
                 header: str) -> int:
    """key 로 찾아 cols 만 갱신하는 SQL. 없는 행은 새로 넣는다."""
    all_cols = key_cols + cols
    updates = ', '.join(f'`{c}`=VALUES(`{c}`)' for c in cols)
    n = 0
    with gzip.open(path, 'wt', encoding='utf-8') as f:
        f.write(f'-- {header}\n')
        f.write('SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSTART TRANSACTION;\n')
        batch: list[str] = []
        for r in rows(select):
            batch.append('(' + ','.join(lit(r[c]) for c in all_cols) + ')')
            n += 1
            if len(batch) >= 500:
                f.write(f'INSERT INTO `{table}` ({",".join(f"`{c}`" for c in all_cols)}) VALUES\n')
                f.write(',\n'.join(batch))
                f.write(f'\nON DUPLICATE KEY UPDATE {updates};\n')
                batch = []
        if batch:
            f.write(f'INSERT INTO `{table}` ({",".join(f"`{c}`" for c in all_cols)}) VALUES\n')
            f.write(',\n'.join(batch))
            f.write(f'\nON DUPLICATE KEY UPDATE {updates};\n')
        f.write('COMMIT;\nSET FOREIGN_KEY_CHECKS=1;\n')
    return n


def main(argv: list[str]) -> int:
    OUT.mkdir(parents=True, exist_ok=True)

    # 1) K-apt 마스터 — 관리자 칸이 없어 통째로 갱신해도 안전하다
    kapt_cols = [c['Field'] for c in rows('SHOW COLUMNS FROM kapt_complexes')]
    body = [c for c in kapt_cols if c != 'kapt_code']
    n1 = write_upsert(
        OUT / 'sync-kapt.sql.gz', 'kapt_complexes', ['kapt_code'], body,
        f'SELECT {",".join(f"`{c}`" for c in kapt_cols)} FROM kapt_complexes',
        'K-apt 단지 마스터',
    )

    # 2) 단지 — 매칭·좌표만. seo_* 는 서버 값을 둔다
    n2 = write_upsert(
        OUT / 'sync-apts.sql.gz', 'apartments', ['id'], APT_COLS,
        f'SELECT id,{",".join(f"`{c}`" for c in APT_COLS)} FROM apartments '
        'WHERE kapt_code IS NOT NULL OR lat IS NOT NULL',
        '단지 매칭·좌표 (id 로 찾아 갱신)',
    )

    # 3) 분양 공고 — 수집 칸만. id·seo·landing·노출설정은 서버 값을 둔다
    n3 = write_upsert(
        OUT / 'sync-presale.sql.gz', 'presale_notices', ['house_manage_no', 'pblanc_no'],
        NOTICE_COLS,
        f'SELECT house_manage_no,pblanc_no,{",".join(f"`{c}`" for c in NOTICE_COLS)} '
        'FROM presale_notices',
        '분양 공고 (청약홈 키로 찾아 갱신 — 주소 번호와 관리자 입력은 건드리지 않는다)',
    )

    # 4) 분양 주택형 — 관리자 칸 없음
    type_cols = [c['Field'] for c in rows('SHOW COLUMNS FROM presale_types')]
    keys = ['house_manage_no', 'pblanc_no', 'model_no']
    n4 = write_upsert(
        OUT / 'sync-presale-types.sql.gz', 'presale_types', keys,
        [c for c in type_cols if c not in keys],
        f'SELECT {",".join(f"`{c}`" for c in type_cols)} FROM presale_types',
        '분양 주택형',
    )

    print(f'  sync-kapt.sql.gz           {n1:,} 행')
    print(f'  sync-apts.sql.gz           {n2:,} 행')
    print(f'  sync-presale.sql.gz        {n3:,} 행')
    print(f'  sync-presale-types.sql.gz  {n4:,} 행')
    for f in sorted(OUT.glob('sync-*.sql.gz')):
        print(f'    {f.name}  {f.stat().st_size / 1048576:.1f} MB')
    print()
    print('서버 적용 (순서 중요 — 주택형은 공고가 있어야 들어간다):')
    print('  scp deploy/dump/sync-*.sql.gz root@158.247.244.167:/tmp/')
    print('  for f in kapt apts presale presale-types; do')
    print('    gunzip -c /tmp/sync-$f.sql.gz | docker exec -i shared-db \\')
    print('      sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" atb_db\'')
    print('  done')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
