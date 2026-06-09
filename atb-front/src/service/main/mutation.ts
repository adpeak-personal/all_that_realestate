import { useMutation } from '@tanstack/react-query';
import { syncAptTrades } from './api';

/** 실거래가 DB 저장 mutation */
export function useSyncAptTrades() {
  return useMutation({
    mutationFn: syncAptTrades,
  });
}
