import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone traces the server into .next/standalone for the container image.
  output: "standalone",
  // End-to-end runs use a separate build directory so they can start beside `next dev`.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
    ],
  },
  // Keep the Postgres driver external so Next does not bundle it.
  serverExternalPackages: [
    "@node-rs/argon2",
    "@prisma/adapter-pg",
    "@prisma/client",
    "pg",
  ],
  // Argon2 and sharp load native files by platform. The tracer does not follow those requires.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@node-rs/argon2*/**/*",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
    ],
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
