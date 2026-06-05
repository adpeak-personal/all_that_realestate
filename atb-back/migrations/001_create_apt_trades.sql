CREATE TABLE IF NOT EXISTS apt_trades (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- 지역
    sgg_cd        INT          NOT NULL COMMENT '시군구코드 (예: 11650)',
    umd_nm        VARCHAR(50)  NOT NULL COMMENT '읍면동명 (예: 방배동)',
    jibun         VARCHAR(20)           COMMENT '지번',

    -- 단지
    apt_nm        VARCHAR(100) NOT NULL COMMENT '아파트명',
    apt_dong      VARCHAR(50)           COMMENT '동',
    build_year    SMALLINT UNSIGNED     COMMENT '건축년도',

    -- 거래
    deal_amount   INT UNSIGNED NOT NULL COMMENT '거래금액 만원 단위 (쉼표 제거 정수)',
    deal_date     DATE         NOT NULL COMMENT '거래일 (deal_year/month/day 합산)',
    deal_year     SMALLINT UNSIGNED NOT NULL COMMENT '계약년 (예: 2026)',
    deal_month    TINYINT  UNSIGNED NOT NULL COMMENT '계약월 (예: 3)',
    deal_day      TINYINT  UNSIGNED NOT NULL COMMENT '계약일 (예: 25)',
    exclu_use_ar  DECIMAL(7,2) NOT NULL COMMENT '전용면적 ㎡',
    floor         SMALLINT     NOT NULL COMMENT '층',

    -- 거래 유형
    dealing_gbn   VARCHAR(10)  COMMENT '중개거래 / 직거래 등',
    buyer_gbn     VARCHAR(10)  COMMENT '매수자 구분 (개인/법인)',
    sler_gbn      VARCHAR(10)  COMMENT '매도자 구분 (개인/법인)',
    land_leasehold_gbn CHAR(1) DEFAULT 'N' COMMENT '토지임대부 여부',

    -- 계약 해제
    cdeal_type    VARCHAR(20)  COMMENT '해제 사유',
    cdeal_day     VARCHAR(10)  COMMENT '해제일',

    -- 중개사
    estate_agent_sgg_nm VARCHAR(50) COMMENT '중개사 소재지 시군구',

    -- 등기
    rgst_date     VARCHAR(10)  COMMENT '등기일 (YY.MM.DD)',

    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- 중복 방지: 같은 단지·층·면적·날짜·금액은 동일 거래로 간주
    UNIQUE KEY uq_trade (sgg_cd, apt_nm, apt_dong, deal_date, floor, exclu_use_ar, deal_amount),

    INDEX idx_region_date  (sgg_cd, deal_date),
    INDEX idx_apt_nm       (apt_nm),
    INDEX idx_deal_date    (deal_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='아파트 매매 실거래가';
