import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClubPage, { type Page } from "../club-page";
import { pagePaths, descriptions } from "../site-pages";
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
  return { title, description: descriptions[page], alternates: { canonical: url },
    openGraph: { title, description: descriptions[page], url } };
}
export default async function Section({ params }: Props) {
  const page = await resolvePage(params);
  if (!page) notFound();
  return <ClubPage initialPage={page} />;
}
