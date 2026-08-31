import type { NextConfig } from "next";

/* Cabeçalhos de segurança padrão. Nenhum deles afeta o site em si — só
   fecham vetores triviais. CSP ficou de fora de propósito: o projeto usa
   estilos e scripts inline (GSAP, gtag, Clarity) e uma CSP mal calibrada
   quebraria a cena em produção sem avisar em desenvolvimento. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
