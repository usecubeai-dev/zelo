import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Analytics from "@/components/Analytics";
import "./globals.css";

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
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://zelopay.com.br";

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
    /* TODO(marca): adicionar `images` quando o asset oficial da logo
       estiver no projeto. Sem imagem, o compartilhamento cai no card de
       texto — melhor isso do que uma imagem improvisada. */
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
    /* TODO(marca): mesma pendência de imagem do Open Graph. */
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  /* TODO(negócio): quando existir CNPJ/razão social confirmados, avaliar
     JSON-LD de Organization. Não preenchido para não inventar dado. */
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
