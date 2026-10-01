import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Analytics from "@/components/Analytics";
import "./globals.css";
import "./product-tokens.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

/* A URL pública alimenta canonical, Open Graph, robots e sitemap.
   Configurável por ambiente para o preview da Vercel não se anunciar
   como se fosse o domínio de produção. */
/* `??` só cai no fallback quando o valor é null/undefined — uma variável
   de ambiente deixada em branco no painel de hospedagem chega como
   string vazia, não como ausente, e `new URL("")` quebra o build. `||`
   trata os dois casos. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://zelopay.com.br";

const TITULO = "Zelo — pare de cobrar, comece a receber";
const DESCRICAO =
  "Automatize suas cobranças recorrentes via Pix Automático e receba sem precisar lembrar seus clientes de pagar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITULO,
    template: "%s · Zelo",
  },
  description: DESCRICAO,
  applicationName: "Zelo",
  alternates: { canonical: "/" },
  keywords: [
    "cobrança recorrente",
    "Pix Automático",
    "mensalidade",
    "cobrança automática",
    "recebimento recorrente",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Zelo",
    title: TITULO,
    description: DESCRICAO,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Zelo — cobrança recorrente no Pix Automático",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  /* TODO(negócio): CNPJ/razão social definitivos já existem (ver /termos,
     /privacidade, rodapé) desde 10/09/2026 — GOGOMOB TECNOLOGIA BR LTDA,
     CNPJ 48.443.579/0001-93, substituindo o MEI provisório anterior.
     JSON-LD de Organization ainda não foi adicionado (não é o mesmo bloco
     que corrige a identificação nas páginas legais) — falta decidir o
     conteúdo do schema (nome exibido, logo, sameAs) antes de publicar,
     não falta mais o CNPJ em si. */
};

export const viewport: Viewport = {
  themeColor: "#0A0F0D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jakarta.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
