import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Footer } from "@/components/layout/Footer";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_TITLE_DEFAULT, SOCIAL_LINKS } from "@/constants/site";
import { ALL_SEO_KEYWORDS } from "@/constants/seo";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f172a" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

const WEB_SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  alternateName: ["Anime Village", "animevillage", "animevillage.org"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?search={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  alternateName: ["Anime Village", "animevillage", "animevillage.org"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  sameAs: [...SOCIAL_LINKS],
};

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How can I watch anime online for free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Anime Village lets you stream thousands of anime series for free with both sub (subtitles) and dub (English dubbed) options. Just search for your favorite anime and start watching.",
      },
    },
    {
      "@type": "Question",
      name: "What is Anime Village?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Anime Village is a free anime streaming site. Stream One Piece, Naruto, Jujutsu Kaisen, Demon Slayer and 10,000+ anime with sub and dub.",
      },
    },
    {
      "@type": "Question",
      name: "Does Anime Village have English sub and dub?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Most anime on Anime Village are available with English subtitles (sub) and English dubbed (dub) versions. Toggle between them on each anime page.",
      },
    },
    {
      "@type": "Question",
      name: "Can I watch anime online free on Anime Village?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Anime Village is a free anime streaming site. Search for a series, pick an episode, and watch online with sub or dub.",
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE_DEFAULT,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [...ALL_SEO_KEYWORDS],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — watch anime online free with English sub and dub`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: "entertainment",
  verification: {
    google: "QFwlV5RYwIEsVd1vRMwIDymOoFTbsXXymurEz8kmBtc",
    other: {
      "msvalidate.01": "5327699643950CD79841C270F5840575",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <GoogleAnalytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(WEB_SITE_JSON_LD),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_JSON_LD),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(FAQ_JSON_LD),
          }}
        />
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <div className="flex min-h-screen flex-col">
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
