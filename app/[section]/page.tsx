import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClubPage, { type Page } from "../club-page";
import { pagePaths, descriptions } from "../site-pages";
import { listGalleryAlbums } from "../api/empire/gallery/gallery-data";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ section: string }> };
async function resolvePage(params: Props["params"]) {
  const { section } = await params;
  return (Object.keys(pagePaths) as Page[]).find(page => pagePaths[page] === `/${section}`);
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await resolvePage(params);
  if (!page) return { robots: { index: false, follow: true } };
  const title = `${page} | Empire Bowls Club Greenhithe`;
  const url = `https://empirebowlsclub.co.uk${pagePaths[page]}`;
  const description = descriptions[page];
  const image = "https://empirebowlsclub.co.uk/optimized/og-empire-clubhouse.jpg";
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_GB",
      siteName: "Empire Bowls Club",
      title,
      description,
      url,
      images: [{
        url: image,
        width: 1200,
        height: 900,
        type: "image/jpeg",
        alt: "Empire Bowls Club green and clubhouse in Greenhithe, Kent",
      }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
export default async function Section({ params }: Props) {
  const page = await resolvePage(params);
  if (!page) notFound();
  // Read only the public gallery projection. If storage is temporarily down,
  // retain the client retry rather than rendering a false empty gallery.
  const gallery = page === "Gallery" ? await listGalleryAlbums().catch(() => null) : null;
  return <ClubPage initialPage={page} initialGallery={gallery} />;
}
