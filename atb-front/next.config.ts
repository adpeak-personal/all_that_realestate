import type { NextConfig } from "next";

// 컨테이너 안에서는 백엔드가 localhost 가 아니라 다른 컨테이너(atb-back)다.
// 로컬 개발에서는 값이 없으니 지금까지처럼 localhost:4030 을 쓴다.
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4030";

const nextConfig: NextConfig = {
  // 도커 이미지를 작게 만들기 위한 실행 묶음(standalone).
  // node_modules 전체 대신 실제로 쓰는 파일만 담긴다.
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
