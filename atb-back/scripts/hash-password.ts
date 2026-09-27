/**
 * 관리자 비밀번호 해시 생성기.
 *
 *   npx ts-node scripts/hash-password.ts '원하는비밀번호'
 *
 * 출력된 줄을 atb-back/.env 에 넣는다. 비밀번호 자체는 어디에도 저장하지 않는다.
 */
import { hashPassword } from '../lib/admin-auth';

const pw = process.argv[2];
if (!pw || pw.length < 8) {
    console.error('사용: npx ts-node scripts/hash-password.ts <비밀번호 8자 이상>');
    process.exit(1);
}
console.log(`ADMIN_PASSWORD_HASH="${hashPassword(pw)}"`);
