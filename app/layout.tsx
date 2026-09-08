import type { Metadata } from "next";
import "./globals.css";
import "./overrides.css";
import "./booking.css";

const siteUrl = "https://empirebowlsclub.co.uk";
const clubSchema = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  name: "Empire Bowls Club",
  description:
    "Empire Bowls Club is a welcoming mixed lawn bowls club in Greenhithe, Kent, established in 1910.",
  url: siteUrl,
  logo: `${siteUrl}/optimized/empire-crest.webp`,
  image: `${siteUrl}/optimized/og-empire-clubhouse.jpg`,
  telephone: "+44 7872 111577",
  sport: "Lawn bowls",
  foundingDate: "1910",
  hasMap:
    "https://www.google.com/maps/search/?api=1&query=Empire+Bowls+Club+Norton+Lane+Greenhithe+DA9+9XY",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Norton Lane",
    addressLocality: "Greenhithe",
    addressRegion: "Kent",
    postalCode: "DA9 9XY",
    addressCountry: "GB",
  },
};
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Empire Bowls Club",
  url: siteUrl,
  inLanguage: "en-GB",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Empire Bowls Club Greenhithe | Lawn bowls in Kent",
  description:
    "Empire Bowls Club Greenhithe is a welcoming mixed lawn bowls club in Kent. Find out how to play bowls, visit the green, follow club news and fixtures, and contact us.",
  applicationName: "Empire Bowls Club",
  keywords: [
    "Empire Bowls Club Greenhithe",
    "lawn bowls Greenhithe",
    "bowls club Kent",
    "bowls near Dartford",
    "try lawn bowls Kent",
  ],
  category: "Sports",
  authors: [{ name: "Empire Bowls Club" }],
  publisher: "Empire Bowls Club",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: siteUrl,
    siteName: "Empire Bowls Club",
    title: "Empire Bowls Club Greenhithe | Lawn bowls in Kent",
    description:
      "A welcoming mixed lawn bowls club in Greenhithe, Kent, established in 1910.",
    images: [
      {
        url: "/optimized/og-empire-clubhouse.jpg",
        width: 1200,
        height: 900,
        type: "image/jpeg",
        alt: "Empire Bowls Club green and clubhouse in Greenhithe, Kent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Empire Bowls Club Greenhithe | Lawn bowls in Kent",
    description:
      "A welcoming mixed lawn bowls club in Greenhithe, Kent, established in 1910.",
    images: ["/optimized/og-empire-clubhouse.jpg"],
  },
  icons: {
    icon: [{ url: "/empire-favicon.png", type: "image/png", sizes: "96x96" }],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          as="image"
          href="/optimized/club/empire-green-clubhouse-768.webp"
          imageSrcSet="/optimized/club/empire-green-clubhouse-768.webp 1x, /optimized/club/empire-green-clubhouse.webp 2x"
          imageSizes="100vw"
          type="image/webp"
          fetchPriority="high"
        />
      </head>
      <body className="antialiased">

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(clubSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
        {children}
      </body>
    </html>
  );
}
