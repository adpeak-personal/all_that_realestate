// apt 페이지에서 사용하는 백엔드 응답/요청 타입

export interface AptTradeItem {
  aptNm: string;
  aptDong: string | number;
  umdNm: string;
  excluUseAr: number;
  floor: number;
  dealAmount: string;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  buildYear: number;
  dealingGbn: string;
  buyerGbn: string;
  slerGbn: string;
}

export interface AptTradesResult {
  items: AptTradeItem[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
}

export interface AptTradesParams {
  lawdCd: string;
  dealYmd: string;
  numOfRows?: number;
}

export interface SyncParams {
  lawdCd: string;
  dealYmd: string;
}

export interface SyncResult {
  message: string;
  saved: number;
  lawdCd: string;
  dealYmd: string;
}

export interface NaverImage {
  pageUrl: string;
  imageUrl: string;
  domain: string;
}

export interface NaverImagesResult {
  items: NaverImage[];
  total: number;
}
