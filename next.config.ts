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
  /* /comecar era uma lista de espera ("em breve entramos em contato") que
     ficou para trás quando o cadastro self-service entrou no ar. Quem chega
     por link antigo vai direto para o cadastro, mantendo ?plano= e ?ref=.
     Temporário (307) de propósito: não cola no cache do navegador. */
  async redirects() {
    return [{ source: "/comecar", destination: "/criar-conta", permanent: false }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
