-- ============================================================
-- 001_init.sql
-- 실행 순서: sgg_codes → apartments → apartment_images → apartment_deals
-- ============================================================

CREATE DATABASE IF NOT EXISTS `atb_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `atb_db`;


-- 0. 지역코드 테이블

CREATE TABLE `sgg_codes` (
  `sgg_cd` INT NOT NULL COMMENT '시군구코드 (PK, 예: 11650)',
  `sido_nm` VARCHAR(40) NOT NULL COMMENT '시/도 명칭 (예: 서울특별시, 경기도)',
  `sgg_nm` VARCHAR(40) NOT NULL COMMENT '시/군/구 명칭 (예: 서초구, 부천시 원미구)',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '수집 및 서비스 활성화 여부 (1: 활성, 0: 비활성)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`sgg_cd`),
  KEY `idx_sido_sgg` (`sido_nm`, `sgg_nm`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='전국 시군구 코드 마스터';

-- 1. 아파트 단지 마스터 ─────────────────────────────────────────
CREATE TABLE `apartments` (
  `id`               BIGINT        NOT NULL AUTO_INCREMENT,
  `sgg_cd`           INT           NOT NULL COMMENT '시군구코드 (예: 11650)',
  `umd_nm`           VARCHAR(50)   NOT NULL COMMENT '법정동명 (예: 방배동)',
  `jibun`            VARCHAR(20)   DEFAULT NULL COMMENT '지번',
  `apt_nm`           VARCHAR(100)  NOT NULL COMMENT '아파트명',
  `build_year`       SMALLINT      DEFAULT NULL COMMENT '건축년도',
  `total_households` INT           DEFAULT NULL COMMENT '총 세대수',
  `total_floors`     SMALLINT      DEFAULT NULL COMMENT '최고 층수',
  `address_road`     VARCHAR(200)  DEFAULT NULL COMMENT '도로명주소',
  `address_jibun`    VARCHAR(200)  DEFAULT NULL COMMENT '지번주소',
  `lat`              DECIMAL(10,7) DEFAULT NULL COMMENT '위도 (WGS84)',
  `lng`              DECIMAL(10,7) DEFAULT NULL COMMENT '경도 (WGS84)',
  `thumbnail_url`    VARCHAR(500)  DEFAULT NULL COMMENT '대표 이미지 URL',
  `apt_status`       VARCHAR(20)   DEFAULT 'COMPLETED' COMMENT '단지 상태 (COMPLETED: 입주완공, PRE_SALE: 분양중)',
  `created_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_apt`     (`sgg_cd`, `apt_nm`, `jibun`),
  KEY `idx_sgg_apt`       (`sgg_cd`, `apt_nm`(50)),
  KEY `idx_apt_nm`        (`apt_nm`(50)),
  KEY `idx_coords`        (`lat`, `lng`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='아파트 단지 마스터';


-- 2. 아파트 이미지 ──────────────────────────────────────────────
CREATE TABLE `apartment_images` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `apt_id`      BIGINT       NOT NULL COMMENT 'apartments.id FK',
  `image_url`   VARCHAR(500) NOT NULL COMMENT '이미지 URL',
  `source`      VARCHAR(30)  DEFAULT NULL COMMENT '출처 (google / naver / kakao / manual)',
  `is_primary`  TINYINT(1)   DEFAULT 0   COMMENT '대표 이미지 여부',
  `sort_order`  SMALLINT     DEFAULT 0   COMMENT '노출 순서',
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_apt_id` (`apt_id`),
  CONSTRAINT `fk_img_apt` FOREIGN KEY (`apt_id`)
    REFERENCES `apartments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='아파트 이미지';


-- 3. 아파트 매매 실거래가 ───────────────────────────────────────
CREATE TABLE `apartment_deals` (
  `id`               BIGINT        NOT NULL AUTO_INCREMENT,
  `transaction_key`  VARCHAR(64)   NOT NULL COMMENT 'MD5(sgg_cd+apt_nm+apt_dong+deal_date+floor+exclu_use_ar+deal_amount)',
  `apt_id`           BIGINT        DEFAULT NULL COMMENT 'apartments.id FK (추후 매핑)',

  -- 위치
  `sgg_cd`           INT           NOT NULL COMMENT '시군구코드',
  `umd_nm`           VARCHAR(50)   NOT NULL COMMENT '법정동명',
  `jibun`            VARCHAR(20)   DEFAULT NULL,

  -- 단지
  `apt_nm`           VARCHAR(100)  NOT NULL COMMENT '아파트명',
  `apt_dong`         VARCHAR(20)   DEFAULT NULL COMMENT '동',
  `build_year`       SMALLINT      DEFAULT NULL,

  -- 계약
  `deal_date`        DATE          NOT NULL COMMENT '거래일',
  `deal_year`        SMALLINT      NOT NULL,
  `deal_month`       TINYINT       NOT NULL,
  `deal_day`         TINYINT       NOT NULL,
  `deal_amount`      INT           NOT NULL COMMENT '거래금액 (만원)',
  `floor`            SMALLINT      DEFAULT NULL,
  `exclu_use_ar`     DECIMAL(7,4)  NOT NULL COMMENT '전용면적 ㎡',

  -- 거래 특성
  `dealing_gbn`         VARCHAR(20)  DEFAULT NULL COMMENT '거래유형 (중개거래/직거래)',
  `estate_agent_sgg_nm` VARCHAR(100) DEFAULT NULL COMMENT '중개사 소재지',
  `buyer_gbn`           VARCHAR(20)  DEFAULT NULL COMMENT '매수자 구분',
  `sler_gbn`            VARCHAR(20)  DEFAULT NULL COMMENT '매도자 구분',
  `land_leasehold_gbn`  CHAR(1)      DEFAULT 'N'  COMMENT '토지임대부 여부',

  -- 취소/등기
  `rgst_date`        VARCHAR(20)   DEFAULT NULL COMMENT '등기일자',
  `cdeal_day`        VARCHAR(20)   DEFAULT NULL COMMENT '해제사유발생일',
  `cdeal_type`       VARCHAR(20)   DEFAULT NULL COMMENT '해제 사유',

  `created_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transaction`  (`transaction_key`),
  KEY `idx_sgg_date`           (`sgg_cd`, `deal_date`),
  KEY `idx_apt_nm`             (`apt_nm`(50)),
  KEY `idx_apt_id_date`        (`apt_id`, `deal_date`),
  -- GROUP BY 최적화
  KEY `idx_grp_sgg_ym`         (`sgg_cd`, `deal_year`, `deal_month`),
  KEY `idx_grp_apt_ym`         (`apt_nm`(50), `deal_year`, `deal_month`),
  KEY `idx_grp_sgg_area`       (`sgg_cd`, `exclu_use_ar`),

  CONSTRAINT `fk_deal_apt` FOREIGN KEY (`apt_id`)
    REFERENCES `apartments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='아파트 매매 실거래가';
