import type { Metadata } from "next";
import "./globals.css";
import "./overrides.css";
import "./booking.css";

const siteUrl = "https://empire-bowls-club.robert607.chatgpt.site";
const clubSchema = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  name: "Empire Bowls Club",
  description: "A welcoming lawn bowls club in Greenhithe, Kent.",
  url: siteUrl,
  logo: `${siteUrl}/empire-crest.png`,
  image: `${siteUrl}/club/empire-green-clubhouse.png`,
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
  title: "Empire Bowls Club | Lawn bowls in Greenhithe, Kent",
  description:
    "Empire Bowls Club is a welcoming lawn bowls club in Greenhithe, Kent. Discover the club, fixtures, news, membership and how to play.",
  applicationName: "Empire Bowls Club",
  keywords: ["Empire Bowls Club", "lawn bowls Greenhithe", "bowls club Kent", "bowls Greenhithe"],
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
    url: "/",
    siteName: "Empire Bowls Club",
    title: "Empire Bowls Club | Lawn bowls in Greenhithe, Kent",
    description: "A welcoming lawn bowls club in Greenhithe, Kent.",
    images: [{ url: "/club/empire-green-clubhouse.png", alt: "The Empire Bowls Club green and clubhouse" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Empire Bowls Club | Lawn bowls in Greenhithe, Kent",
    description: "A welcoming lawn bowls club in Greenhithe, Kent.",
    images: ["/club/empire-green-clubhouse.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(clubSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
        {children}
      </body>
    </html>
  );
}
