import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// 전역 보안 응답 헤더. CSP는 YouTube iframe·Supabase OAuth·Stripe redirect를
// 깨뜨릴 수 있어 report-only 관찰 후 별도로 도입한다(여기서는 미포함).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // HSTS는 HTTPS 환경에서만 의미가 있으므로 프로덕션에서만 전송한다.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://192.168.0.81:3000",
    "http://192.168.0.81",
    "192.168.0.81:3000",
    "192.168.0.81",
    "http://192.168.219.102:3000",
    "http://192.168.219.102",
    "192.168.219.102:3000",
    "192.168.219.102",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "yt3.ggpht.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
