"use client";

import {
  FormEvent,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Access = "member" | "admin";
type AdminTab =
  | "overview"
  | "members"
  | "team-sheets"
  | "fixtures"
  | "player-signups"
  | "news"
  | "documents"
  | "security";
type Page =
  | "Home"
  | "About the Club"
  | "News"
  | "Sponsors"
  | "Fixtures"
  | "Honours"
  | "Play bowls"
  | "Contact";
type Booking = {
  id: number | null;
  rinkNumber: number;
  timeSlot: string;
  bookingName: string;
  fixtureKey?: string | null;
};
type Fixture = {
  id: number;
  date: string;
  time: string;
  opponent: string;
  competition: string;
  rinkCount: number;
  rinks: number[];
};
type FixtureImportRow = {
  date: string;
  time: string;
  opponent: string;
  competition: string;
  rinks: number | number[];
};
type Member = {
  id: number;
  name: string;
  dateOfBirth?: string;
  address?: string;
  phone: string;
  email: string;
  membershipType: "Full member" | "Social member";
  createdAt: string;
};
type ClubFile = {
  id: number;
  category: "team_sheet" | "club_document" | "players_required";
  title: string;
  description: string;
  fileName: string;
  createdAt: string;
};
const teamFormats = {
  Singles: ["Player"],
  Pairs: ["Lead", "Skip"],
  Triples: ["Lead", "Second", "Skip"],
  Fours: ["Lead", "Second", "Third", "Skip"],
} as const;
type TeamFormat = keyof typeof teamFormats;
type TeamSheetPlayer = {
  memberId: number;
  name: string;
  position: string;
};
type TeamSheetRink = {
  rink: number;
  format: TeamFormat;
  players: TeamSheetPlayer[];
};
type TeamSheet = {
  id: number;
  opponent: string;
  competition: string;
  matchDate: string;
  rinkCount: number;
  createdAt: string;
  rinks: TeamSheetRink[];
};
type TeamSheetDraftRink = {
  format: TeamFormat;
  memberIds: Array<number | null>;
};
type NewsItem = {
  id: number;
  title: string;
  summary: string;
  body: string;
  category: string;
  accent: string;
  imageUrl: string;
  publishedAt: string;
};

const nav: Page[] = [
  "Home",
  "About the Club",
  "News",
  "Sponsors",
  "Fixtures",
  "Play bowls",
  "Contact",
];
const timeSlots = [
  "10:00–12:00",
  "12:00–14:00",
  "14:00–16:00",
  "16:00–18:00",
  "18:00–21:00",
];
const displayDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
const today = () => new Date().toISOString().slice(0, 10);
const EMPIRE_CONTACT_EMAIL = "stevewebster@btinternet.com";
const EMPIRE_CLUB_NAME = "Empire Bowls Club";
const EMPIRE_DATA_UPDATED_EVENT = "empire-data-updated";

function notifyEmpireDataUpdated() {
  window.dispatchEvent(new Event(EMPIRE_DATA_UPDATED_EVENT));
}

function openEmpireEnquiry(data: FormData) {
  const body = [
    `Name: ${String(data.get("name") ?? "").trim()}`,
    `Email: ${String(data.get("email") ?? "").trim()}`,
    `Telephone: ${String(data.get("phone") ?? "").trim()}`,
    "",
    "Message:",
    String(data.get("message") ?? "").trim(),
    "",
    `Sent via the ${EMPIRE_CLUB_NAME} website.`,
  ].join("\n");
  const subject = `Website Enquiry – ${EMPIRE_CLUB_NAME}`;
  (window as Window & { websiteUsageTrackGoal?: (goalName: string) => void })
    .websiteUsageTrackGoal?.("email-handoff");
  window.location.href = `mailto:${EMPIRE_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const committee = [
  ["Chairman", "Steve Webster", "07872 111577"],
  ["Secretary", "Ann Norris", "07852 975351"],
  ["Treasurer & Competition Secretary", "Steve Webster", "07872 111577"],
  [
    "Weekend Captain, Fixtures Secretary & NWK Representative",
    "Ray Norris",
    "07706 084755",
  ],
  [
    "Midweek Captain, Bar Manager & County Representative",
    "Dave Munday",
    "07890 853525",
  ],
  ["Head Greenkeeper", "Chris Read", "07976 329351"],
  ["Safeguarding Officer", "Richard Stone", "07980 389398"],
];
const fixtureMessage =
  "The fixtures are taking a winter break — we’ll see you next summer with a full schedule of games!";
const fixtureHighlights: Array<{ date: string; event: string; type: string }> = [];
const starterNews: NewsItem[] = [
  {
    id: -1,
    title: "Welcome to the Empire noticeboard",
    summary:
      "A new home for club moments, match-day stories and the little updates that make our green feel like home.",
    body: "The Empire News page is where we will share the people, fixtures, celebrations and behind-the-scenes moments that keep our club connected.",
    category: "Club life",
    accent: "gold",
    imageUrl: "",
    publishedAt: "2025-01-01T09:00:00.000Z",
  },
  {
    id: -2,
    title: "New bowlers are always welcome",
    summary:
      "Never played before? Come and have a go with friendly members, loan equipment and a relaxed introduction.",
    body: "Bowls is a game for all ages and abilities. Contact Steve to arrange a first visit and discover the Empire welcome for yourself.",
    category: "Welcome",
    accent: "green",
    imageUrl: "",
    publishedAt: "2024-12-01T09:00:00.000Z",
  },
  {
    id: -3,
    title: "Good bowls, good company",
    summary:
      "From Monday practice afternoons to competitive fixtures, there is always a reason to step onto the green.",
    body: "Keep an eye on the fixtures page and the members area for the latest sessions, team sheets and club updates.",
    category: "On the green",
    accent: "navy",
    imageUrl: "",
    publishedAt: "2024-11-01T09:00:00.000Z",
  },
];
const sponsors = [
  {
    name: "Frost Funeral Service",
    tier: "Empire club sponsor",
    strapline: "Professional, caring funeral services for the local community.",
    image: "/optimized/sponsors/frost-funeral-service.webp",
    website:
      "https://funeral-notices.co.uk/services-directory/view/4589?source=notice",
    linkLabel: "View sponsor information",
    note: "No standalone official website was identified; this opens the local business listing.",
  },
  {
    name: "In Action Bowlswear",
    tier: "Empire club sponsor",
    strapline: "Bowls clothing, equipment and friendly specialist advice.",
    image: "/optimized/sponsors/inaction-bowlswear.webp",
    website: "https://inactionbowlswear.co.uk/",
    linkLabel: "Visit inactionbowlswear.co.uk",
  },
  {
    name: "Mike’s Maindrain Services",
    tier: "Empire club sponsor",
    strapline: "Drain, sewer and waste services for homes and businesses.",
    image: "/optimized/sponsors/mikes-maindrain.webp",
    website: "https://www.checkatrade.com/trades/mikesmaindrain",
    linkLabel: "View sponsor profile",
    note: "This opens the company’s verified trade profile.",
  },
  {
    name: "NH Heating Services",
    tier: "Empire club sponsor",
    strapline: "Domestic and commercial heating support across Kent.",
    image: "/optimized/sponsors/nh-heating.webp",
    website: "https://www.nhheating.co.uk/",
    linkLabel: "Visit nhheating.co.uk",
  },
];
function apiHeaders(_access: Access, _password: string) {
  // Browser credentials are now held in a short-lived HttpOnly cookie, so no
  // password or bearer token is exposed to the page or sent in request headers.
  void _access;
  void _password;
  return {};
}
function Status({
  message,
  type = "success",
}: {
  message: string;
  type?: "success" | "error";
}) {
  return <p className={`status ${type}`}>{message}</p>;
}

type ZipEntry = { compression: number; compressed: Uint8Array };

function zipEntries(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let directory = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      directory = view.getUint32(index + 16, true);
      break;
    }
  }
  if (directory < 0) throw new Error("This does not look like a valid .xlsx file.");
  const entries = new Map<string, ZipEntry>();
  for (let offset = directory; offset + 46 <= bytes.length && view.getUint32(offset, true) === 0x02014b50;) {
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("The spreadsheet contains an unreadable file entry.");
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    entries.set(name, { compression, compressed: bytes.slice(start, start + compressedSize) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function unzipText(entries: Map<string, ZipEntry>, name: string) {
  const entry = entries.get(name);
  if (!entry) throw new Error("The spreadsheet is missing a required worksheet.");
  let content: Uint8Array;
  if (entry.compression === 0) {
    content = entry.compressed;
  } else if (entry.compression === 8 && "DecompressionStream" in window) {
    const stream = new Blob([new Uint8Array(entry.compressed)])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    content = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    throw new Error("This browser cannot read the compression used by this spreadsheet.");
  }
  return new TextDecoder().decode(content);
}

function childText(element: Element, name: string) {
  return Array.from(element.children).find((child) => child.localName === name)?.textContent ?? "";
}

function columnNumber(reference: string) {
  const letters = /^([A-Z]+)/i.exec(reference)?.[1] ?? "A";
  return [...letters.toUpperCase()].reduce((result, letter) => result * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

async function readXlsxRows(file: File): Promise<Array<Array<string | number>>> {
  const entries = zipEntries(await file.arrayBuffer());
  const decoder = new DOMParser();
  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? Array.from(decoder.parseFromString(await unzipText(entries, "xl/sharedStrings.xml"), "application/xml").getElementsByTagName("si"), (item) => item.textContent ?? "")
    : [];
  const workbook = decoder.parseFromString(await unzipText(entries, "xl/workbook.xml"), "application/xml");
  const firstSheet = workbook.getElementsByTagName("sheet")[0];
  const relationId = firstSheet?.getAttribute("r:id") ?? "";
  const relationships = decoder.parseFromString(await unzipText(entries, "xl/_rels/workbook.xml.rels"), "application/xml");
  const target = Array.from(relationships.getElementsByTagName("Relationship")).find((relationship) => relationship.getAttribute("Id") === relationId)?.getAttribute("Target") ?? "worksheets/sheet1.xml";
  const worksheetName = `xl/${target.replace(/^\/+/, "").replace(/^\.\//, "")}`;
  const sheet = decoder.parseFromString(await unzipText(entries, worksheetName), "application/xml");
  return Array.from(sheet.getElementsByTagName("row"), (row) => {
    const values: Array<string | number> = [];
    Array.from(row.getElementsByTagName("c")).forEach((cell) => {
      const value = childText(cell, "v");
      const inline = childText(cell, "is");
      const type = cell.getAttribute("t");
      const column = columnNumber(cell.getAttribute("r") ?? "A1");
      if (type === "s") values[column] = sharedStrings[Number(value)] ?? "";
      else if (type === "inlineStr") values[column] = inline;
      else if (type === "b") values[column] = value === "1" ? "Yes" : "No";
      else values[column] = value !== "" && Number.isFinite(Number(value)) ? Number(value) : value;
    });
    return values;
  });
}

function headerName(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function spreadsheetDate(value: string | number) {
  if (typeof value === "number" && value > 1) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000).toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parts = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(text);
  if (parts) return `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  return "";
}

function spreadsheetTime(value: string | number) {
  if (typeof value === "number" && value >= 0 && value < 1) {
    const minutes = Math.round(value * 1440);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const text = String(value).trim().toLowerCase().replace(".", ":");
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(text);
  if (!match) return "";
  let hour = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  if (match[3] === "pm" && hour < 12) hour += 12;
  if (match[3] === "am" && hour === 12) hour = 0;
  return hour < 24 && minutes < 60 ? `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}` : "";
}

function spreadsheetRinks(value: string | number) {
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text);
  const range = /^(?:rinks?\s*)?(\d)\s*-\s*(\d)$/i.exec(text);
  if (range) return Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, index) => Number(range[1]) + index);
  const listed = text.match(/\d+/g)?.map(Number) ?? [];
  return listed.length ? [...new Set(listed)] : null;
}

async function parseFixtureSpreadsheet(file: File): Promise<FixtureImportRow[]> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Please choose an Excel .xlsx workbook.");
  const rows = await readXlsxRows(file);
  const headers = rows[0] ?? [];
  const indexFor = (...names: string[]) => headers.findIndex((header) => names.includes(headerName(header)));
  const columns = {
    date: indexFor("date"),
    time: indexFor("time"),
    opponent: indexFor("opponent"),
    competition: indexFor("league", "competition", "leagueorcompetition", "whichleagueofcompetition"),
    rinks: indexFor("rinks", "rinksneeded", "whichrinksneeded", "rinkneeded"),
  };
  if (Object.values(columns).some((index) => index < 0)) {
    throw new Error("The first row must contain: Date, Time, Opponent, Which League of competition, and Which rinks needed.");
  }
  const fixtures: FixtureImportRow[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.some((value) => String(value ?? "").trim())) continue;
    const date = spreadsheetDate(row[columns.date] ?? "");
    const time = spreadsheetTime(row[columns.time] ?? "");
    const opponent = String(row[columns.opponent] ?? "").trim();
    const competition = String(row[columns.competition] ?? "").trim();
    const rinks = spreadsheetRinks(row[columns.rinks] ?? "");
    if (!date || !time || !opponent || !competition || rinks === null || (Array.isArray(rinks) ? rinks.some((rink) => rink < 1 || rink > 6) : rinks < 1 || rinks > 6)) {
      throw new Error(`Row ${index + 1} is incomplete or has an invalid date, time or rink value.`);
    }
    fixtures.push({ date, time, opponent, competition, rinks });
  }
  if (!fixtures.length) throw new Error("There are no fixture rows below the headings.");
  return fixtures;
}

export default function Home() {
  const [page, setPage] = useState<Page>("Home");
  const [portalOpen, setPortalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [access, setAccess] = useState<Access | null>(null);
  const [password, setPassword] = useState("");
  const openPage = (next: Page) => {
    setPage(next);
    setAccess(null);
    setPassword("");
    setPortalOpen(false);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openPortal = () => {
    setAccess(null);
    setPassword("");
    setPortalOpen(true);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <>
      <header className={`site-header${menuOpen ? " menu-open" : ""}`}>
        <button
          className="brand"
          onClick={() => openPage("Home")}
          aria-label="Empire Bowls Club home"
        >
          <img
            src="/optimized/empire-crest.webp"
            alt="Empire Bowls Club crest"
            width={512}
            height={512}
            decoding="async"
          />
          <span>
            Empire Bowls Club<small>Greenhithe · Kent</small>
          </span>
        </button>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span>{menuOpen ? "Close" : "Menu"}</span>
          <i aria-hidden="true" />
        </button>
        <nav id="main-navigation" aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item}
              className={!portalOpen && page === item ? "active" : ""}
              onClick={() => openPage(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <button className="portal-button" onClick={openPortal}>
          Member Zone
        </button>
      </header>
      {portalOpen ? (
        <Portal
          access={access}
          password={password}
          setAccess={setAccess}
          setPassword={setPassword}
        />
      ) : (
        <main>{renderPage(page, openPage, openPortal)}</main>
      )}
      <footer>
        <img
          src="/optimized/empire-crest.webp"
          alt=""
          width={512}
          height={512}
          loading="lazy"
          decoding="async"
        />
        <div>
          <b>Empire Bowls Club</b>
          <span>Norton Lane, Greenhithe, Kent, DA9 9XY</span>
        </div>
        <a
          className="site-credit"
          href="https://bowlsclubdigital.com"
          target="_blank"
          rel="noreferrer"
        >
          Created for bowlers by a bowler – bowlsclubdigital.com
        </a>
      </footer>
    </>
  );
}

function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/empire/news", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("News request failed");
      const result = await response.json();
      setItems(result.news ?? []);
      setLoadError("");
    } catch {
      setLoadError("The latest stories could not be loaded right now.");
    }
  }, []);
  useEffect(() => {
    const handleUpdate = () => void refresh();
    const timer = window.setTimeout(handleUpdate, 0);
    window.addEventListener(EMPIRE_DATA_UPDATED_EVENT, handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(EMPIRE_DATA_UPDATED_EVENT, handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [refresh]);
  const displayItems = items.length ? items : starterNews;
  const featured = displayItems[0];
  return (
    <section className="news-page">
      <div className="wrap news-intro">
        <p className="eyebrow">The Empire noticeboard</p>
        <h1>News from the green.</h1>
        <p className="lead">
          Club moments, match-day stories and little updates that keep our
          community connected.
        </p>
        {loadError && <p className="news-load-error">{loadError}</p>}
      </div>
      {featured ? (
        <div className={`wrap news-feature news-accent-${featured.accent}`}>
          <div className="news-feature-art">
            <span className="news-stamp">Latest</span>
            {featured.imageUrl ? (
              <img
                src={featured.imageUrl}
                alt={featured.title}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            ) : (
              <div className="news-art-mark" aria-hidden="true">
                <span>EB</span>
              </div>
            )}
            <i>
              EMPIRE
              <br />
              ON THE GREEN
            </i>
          </div>
          <div className="news-feature-copy">
            <span className="news-category">
              {featured.category} · {displayNewsDate(featured.publishedAt)}
            </span>
            <h2>{featured.title}</h2>
            <p>{featured.summary}</p>
            <details>
              <summary>
                Read the full story <span>+</span>
              </summary>
              <p>{featured.body}</p>
            </details>
          </div>
        </div>
      ) : (
        <div className="wrap news-empty">
          <span aria-hidden="true">EB</span>
          <h2>The noticeboard is ready.</h2>
          <p>Our latest club stories will appear here soon.</p>
        </div>
      )}
      <section className="wrap news-stream">
        <div className="news-stream-heading">
          <div>
            <p className="eyebrow">Fresh from Empire</p>
            <h2>Stories worth sharing</h2>
          </div>
          <span className="news-count">{displayItems.length} updates</span>
        </div>
        {displayItems.length > 1 ? (
          <div className="news-grid">
            {displayItems.slice(1).map((item, index) => (
              <article
                className={`news-card news-accent-${item.accent}`}
                key={item.id}
              >
                <div className="news-card-art">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span aria-hidden="true">EB</span>
                  )}
                  <b>{String(index + 2).padStart(2, "0")}</b>
                </div>
                <div className="news-card-body">
                  <span className="news-category">
                    {item.category} · {displayNewsDate(item.publishedAt)}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <details>
                    <summary>
                      Open story <span>→</span>
                    </summary>
                    <p>{item.body}</p>
                  </details>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="news-empty-inline">
            No older stories yet — check back after the next club update.
          </p>
        )}
      </section>
      <section className="news-ribbon">
        <div className="wrap">
          <span>Empire energy</span>
          <b>Good bowls, good company, good news.</b>
          <span>♢</span>
          <span>Est. 1910</span>
        </div>
      </section>
    </section>
  );
}
function displayNewsDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(parsed);
}
function renderPage(
  page: Page,
  openPage: (page: Page) => void,
  openPortal: () => void,
) {
  if (page === "Home")
    return <HomePage openPage={openPage} />;
  if (page === "About the Club") return <AboutPage />;
  if (page === "News") return <NewsPage />;
  if (page === "Sponsors") return <SponsorsPage />;
  if (page === "Fixtures") return <FixturesPage />;
  if (page === "Honours") return <HonoursPage />;
  if (page === "Play bowls") return <PlayBowlsPage openPortal={openPortal} />;
  return <ContactPage />;
}
function HomePage({
  openPage,
}: {
  openPage: (page: Page) => void;
}) {
  return (
    <>
      <section className="hero empire-hero">
        <span className="peacock-tail-pattern peacock-tail-pattern-hero" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">Established in 1910 · Greenhithe, Kent</p>
          <h1>
            Bowls with heart,
            <br />
            <em>for everyone.</em>
          </h1>
          <p>
            Empire is a welcoming mixed lawn bowls club where good competition,
            friendship and a beautiful green belong together.
          </p>
          <div className="button-row">
            <button className="primary" onClick={() => openPage("Play bowls")}>
              Come and try bowls
            </button>
            <button
              className="text-button hero-secondary"
              onClick={() => openPage("About the Club")}
            >
              Explore our story <span>→</span>
            </button>
          </div>
        </div>
        <div className="hero-emblem">
          <img
            src="/optimized/empire-crest.webp"
            alt="Empire Bowls Club crest"
            width={512}
            height={512}
            decoding="async"
          />
          <span>EST. 1910</span>
        </div>
      </section>
      <section className="quick-facts wrap single home-facts">
        <span className="peacock-tail-pattern peacock-tail-pattern-facts" aria-hidden="true" />
        <article>
          <strong>Established 1910</strong>
          <span>A proud Greenhithe sporting tradition</span>
        </article>
        <article>
          <strong>Greenhithe, Kent</strong>
          <span>A community club with a local heart</span>
        </article>
        <article>
          <strong>Six-rink green</strong>
          <span>Space for roll-ups, fixtures and events</span>
        </article>
        <article>
          <strong>April–September</strong>
          <span>Our outdoor playing season</span>
        </article>
        <article>
          <strong>New bowlers welcome</strong>
          <span>A friendly first step into the game</span>
        </article>
      </section>
      <section className="intro-grid wrap home-intro">
        <span className="peacock-tail-pattern peacock-tail-pattern-intro" aria-hidden="true" />
        <div>
          <p className="eyebrow">The Empire welcome</p>
          <h2>A club for the game — and the people who make it.</h2>
          <p>
            Whether you are looking for a new sport, returning after a break, or
            hoping to play competitive bowls, you will find a friendly
            introduction at Empire. Our mixed club welcomes adults of all
            experience levels.
          </p>
          <button
            className="outline"
            onClick={() => openPage("About the Club")}
          >
            Discover our club
          </button>
        </div>
        <div className="green-card club-green-card">
          <img
            className="club-green-image"
            src="/optimized/club/empire-players.webp"
            alt="Empire Bowls Club members gathered on the green"
            width={1200}
            height={900}
            loading="lazy"
            decoding="async"
          />
          <div className="club-green-copy">
            <p>
              “A warm welcome, a superb green, and a real sense of belonging.”
            </p>
            <span>Empire Bowls Club</span>
          </div>
        </div>
      </section>
      <section className="upcoming-section home-upcoming">
        <span className="peacock-tail-pattern peacock-tail-pattern-upcoming" aria-hidden="true" />
        <div className="wrap">
          <div className="section-heading">
            <div>
              <p className="eyebrow">On the green</p>
              <h2>Coming up at Empire</h2>
            </div>
            <button
              className="text-button"
              onClick={() => openPage("Fixtures")}
            >
              View fixtures <span>→</span>
            </button>
          </div>
          <div className="fixture-grid">
            {fixtureHighlights.length > 0 ? (
              fixtureHighlights.map((fixture) => (
                <article key={fixture.event}>
                  <span>{fixture.type}</span>
                  <b>{fixture.date}</b>
                  <h3>{fixture.event}</h3>
                  <button onClick={() => openPage("Fixtures")}>
                    Details <span>→</span>
                  </button>
                </article>
              ))
            ) : (
              <article className="fixture-empty-card">
                <span>Fixtures taking a winter break</span>
                <h3>{fixtureMessage}</h3>
                <button onClick={() => openPage("Fixtures")}>
                  Visit the fixtures page <span>→</span>
                </button>
              </article>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
function SponsorsPage() {
  return (
    <section className="sponsors-page">
      <span className="peacock-tail-pattern peacock-tail-pattern-sponsors" aria-hidden="true" />
      <div className="wrap sponsors-intro">
        <div>
          <p className="eyebrow">Proudly supported</p>
          <h1>The businesses behind Empire.</h1>
          <p className="lead">
            Our sponsors help keep the green thriving. Please support the
            businesses that support our club.
          </p>
        </div>
        <div className="sponsors-intro-seal" aria-hidden="true">
          <img
            src="/optimized/empire-crest.webp"
            alt=""
            width={512}
            height={512}
            decoding="async"
          />
          <span>Community partners</span>
        </div>
      </div>
      <div className="wrap sponsor-grid">
        {sponsors.map((sponsor, index) => (
          <article className="sponsor-card" key={sponsor.name}>
            <div className="sponsor-card-topline">
              <span className="sponsor-tier">{sponsor.tier}</span>
              <span className="sponsor-number">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <a
              href={sponsor.website}
              target="_blank"
              rel="noreferrer"
              aria-label={`${sponsor.name} website (opens in a new tab)`}
            >
              <img
                src={sponsor.image}
                alt={`${sponsor.name} logo`}
                loading="lazy"
                decoding="async"
              />
              <span>
                Visit website <b>↗</b>
              </span>
            </a>
            <div className="sponsor-card-copy">
              <h2>{sponsor.name}</h2>
              <p>{sponsor.strapline}</p>
              {sponsor.note && <small>{sponsor.note}</small>}
              <a
                className="sponsor-link"
                href={sponsor.website}
                target="_blank"
                rel="noreferrer"
              >
                {sponsor.linkLabel} <span>↗</span>
              </a>
            </div>
          </article>
        ))}
      </div>
      <div className="sponsors-thanks">
        <div className="wrap">
          <span>COMMUNITY PARTNERS</span>
          <b>Every sponsor makes a difference.</b>
          <i>Thank you for backing Empire.</i>
        </div>
      </div>
    </section>
  );
}
function AboutPage() {
  return (
    <section className="page wrap">
      <span className="peacock-tail-pattern peacock-tail-pattern-about" aria-hidden="true" />
      <p className="eyebrow">About the club</p>
      <h1>A century of community on the green.</h1>
      <p className="lead">
        Explore the story, people and proud moments that make Empire Bowls Club
        what it is.
      </p>
      <div className="about-layout">
        <div className="accordion-list">
          <details open>
            <summary>
              <span>04</span>
              <b>The Empire story</b>
              <i>+</i>
            </summary>
            <div className="heritage-story">
              <div className="heritage-hero-collage">
                <img
                  src="/optimized/club/empire-players.webp"
                  alt="Empire Bowls Club members gathered on the green"
                  width={1200}
                  height={900}
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <span>1910 · Greenhithe</span>
                  <strong>More than a century on the green.</strong>
                </div>
              </div>
              <div className="heritage-lead-grid">
                <div className="heritage-year-mark">
                  <strong>1910</strong>
                  <span>Where the story begins</span>
                </div>
                <div>
                  <p className="heritage-kicker">A Greenhithe story</p>
                  <blockquote>
                    “Long before Empire Bowls Club became the club we know
                    today, it began as part of a community built around one of
                    Greenhithe’s great industries.”
                  </blockquote>
                  <p>
                    Empire Bowls Club was founded in 1910 as the lawn bowls
                    section of the works social club connected with the large
                    paper mill at Greenhithe. At that time, the factory site
                    was known as the Ingress Abbey Paper Mill. The Empire name
                    came later: after Associated Newspapers acquired the
                    complex in 1919, it became known as Empire Paper Mills.
                    That later identity is the source of the club’s Empire
                    name.
                  </p>
                </div>
              </div>

              <h3>Born from a mill community</h3>
              <p>
                Paper production at the Greenhithe site had begun in 1908. The
                mill became one of the area’s significant employers, shaping
                everyday life as well as the skyline. Housing was created for
                workers, while the company provided gardens, recreation
                grounds and social facilities for its workforce.
              </p>
              <p>
                The bowling green formed part of that wider culture of
                recreation and community. Generations of local people had
                connections with the paper mill and its sporting facilities,
                helping the bowls club grow from a works section into a lasting
                part of Greenhithe life.
              </p>

              <div className="heritage-timeline" aria-label="Empire heritage timeline">
                <article className="heritage-event heritage-era-wood">
                  <time dateTime="1908">
                    <span className="era-bowl" aria-hidden="true" />
                    <span className="heritage-date">1908</span>
                  </time>
                  <div>
                    <h4>Paper production begins</h4>
                    <p>
                      The Greenhithe site begins producing paper and becomes an
                      increasingly important local employer.
                    </p>
                  </div>
                </article>
                <article className="heritage-event heritage-era-early">
                  <time dateTime="1910">
                    <span className="era-bowl" aria-hidden="true" />
                    <span className="heritage-date">1910</span>
                  </time>
                  <div>
                    <h4>The lawn bowls section is formed</h4>
                    <p>
                      People connected with the mill establish a lawn bowls
                      section within the works social club — the beginning of
                      the club we know today.
                    </p>
                  </div>
                </article>
                <article className="heritage-event heritage-era-painted">
                  <time dateTime="1919">
                    <span className="era-bowl" aria-hidden="true" />
                    <span className="heritage-date">1919</span>
                  </time>
                  <div>
                    <h4>The Empire name is adopted</h4>
                    <p>
                      Associated Newspapers acquires the complex and changes
                      its name to Empire Paper Mills. The Empire name is now
                      associated with the site; it was not the name used when
                      the bowls section began in 1910.
                    </p>
                  </div>
                </article>
                <article className="heritage-event heritage-era-midcentury">
                  <time dateTime="1952">
                    <span className="era-bowl" aria-hidden="true" />
                    <span className="heritage-date">1952</span>
                  </time>
                  <div>
                    <h4>A changing paper industry</h4>
                    <p>
                      Empire Paper Mills becomes part of the Reed Group, while
                      the sporting and social life around the green continues.
                    </p>
                  </div>
                </article>
                <article className="heritage-event heritage-era-late">
                  <time>
                    <span className="era-bowl" aria-hidden="true" />
                    <span className="heritage-date">Early 1990s</span>
                  </time>
                  <div>
                    <h4>The mill closes — but the bowls club survives</h4>
                    <p>
                      By the early 1990s, the great paper mill that had shaped
                      this part of Greenhithe was in decline and closure had
                      become inevitable. Historical sources differ slightly
                      between 1992 and 1993 for the final closure, so the
                      timeline uses the broader early-1990s wording. The
                      industry disappeared, but the club carried its community
                      tradition forward.
                    </p>
                  </div>
                </article>
                <article className="heritage-event heritage-era-early-modern">
                  <time dateTime="2005-04-25">
                    <span className="era-bowl" aria-hidden="true" />
                    <span className="heritage-date">2005</span>
                  </time>
                  <div>
                    <h4>Empire Bowls Club Limited</h4>
                    <p>
                      Empire Bowls Club Limited is incorporated on 25 April as
                      a company limited by guarantee. This is the incorporation
                      date of the present legal organisation — not the founding
                      date of the bowls club, which dates back to 1910.{" "}
                      <a
                        href="https://find-and-update.company-information.service.gov.uk/company/05434583"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View the Companies House record ↗
                      </a>
                    </p>
                  </div>
                </article>
                <article className="heritage-event heritage-era-contemporary">
                  <time dateTime="2016">
                    <span className="era-bowl" aria-hidden="true" />
                    <span className="heritage-date">2016</span>
                  </time>
                  <div>
                    <h4>The sports ground changes around it</h4>
                    <p>
                      Dartford Borough Council documents still referred to the
                      area as the “Empire Paper Mills Sports Ground” during
                      plans for surrounding development. Much of the former
                      sports-ground land was redeveloped, particularly for
                      housing, while the bowling club remained.
                    </p>
                  </div>
                </article>
                <article className="heritage-event heritage-era-modern">
                  <time>
                    <span className="era-bowl" aria-hidden="true" />
                    <span className="heritage-date">Today</span>
                  </time>
                  <div>
                    <h4>The Empire story continues</h4>
                    <p>
                      More than 115 years after its beginnings, Empire Bowls
                      Club remains at Greenhithe and continues to take an active
                      part in Kent bowls.
                    </p>
                  </div>
                </article>
              </div>

              <div className="heritage-pullquote">
                <strong>The mill disappeared. The Empire remained.</strong>
                <span>
                  A works bowls section became an independent community club,
                  carrying a sporting tradition through industrial change and
                  generations of Greenhithe history.
                </span>
              </div>

              <div className="heritage-two-column">
                <section className="heritage-panel">
                  <p className="heritage-kicker">The old sports ground</p>
                  <h3>A green that stayed</h3>
                  <p>
                    The area around the club was historically known as the
                    Empire Paper Mills Sports Ground. When road names were being
                    considered for the surrounding development, Empire Bowls
                    Club suggested “Bowling Green Lane” — a nod to how long a
                    bowling club had existed at the location.
                  </p>
                  <p>
                    The eventual surrounding road names included Norton Lane,
                    Parkwood Hill and Peacock Close. There is no confirmed
                    evidence that Peacock Close explains the peacock in the
                    club’s identity, but the names remain part of the modern
                    landscape around the green.
                  </p>
                </section>
                <section className="heritage-panel heritage-panel-navy">
                  <p className="heritage-kicker">Empire today</p>
                  <h3>Still writing the story</h3>
                  <p>
                    Empire has survived industrial change, the closure of the
                    paper mill, redevelopment of the former sports ground and
                    more than a century of change in Greenhithe.
                  </p>
                  <p>
                    The surroundings may have changed, but bowls has been part
                    of this corner of Greenhithe since 1910. More than a century
                    later, the Empire story is still being written.
                  </p>
                </section>
              </div>

              <div className="heritage-archive">
                <div>
                  <p className="heritage-kicker">Historical photographs</p>
                  <h3>The world Empire came from</h3>
                  <p>
                    These contextual photographs come from established heritage
                    collections. They show the paper mill and the surrounding
                    Greenhithe setting in the period around the club’s early
                    years. They are not presented as photographs of Empire
                    Bowls Club itself. The club’s own archive photographs can
                    be added here later when they are available and verified.
                  </p>
                </div>
                <div className="heritage-photo-grid">
                  <figure className="heritage-photo-card">
                    <a
                      className="heritage-photo-link"
                      href="https://www.britainfromabove.org.uk/image/epw017657"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src="https://britainfromabove.org.uk/sites/all/libraries/aerofilms-images/public/580w/EPW/017/EPW017657.jpg"
                        alt="Aerial view of Empire Paper Mills and Ingress Abbey Wharf, Greenhithe, in 1927"
                        width={580}
                        height={480}
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                    <figcaption>
                      <b>Empire Paper Mills, Greenhithe · 1927</b>
                      <p>
                        The mill, wharf and surrounding landscape in the era
                        when the Empire identity was developing.{" "}
                        <a
                          href="https://www.britainfromabove.org.uk/image/epw017657"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View the Britain from Above record ↗
                        </a>
                      </p>
                    </figcaption>
                  </figure>
                  <figure className="heritage-photo-card">
                    <a
                      className="heritage-photo-link"
                      href="https://www.britainfromabove.org.uk/en/image/EPW006257"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src="https://britainfromabove.org.uk/sites/all/libraries/aerofilms-images/public/580w/EPW/006/EPW006257.jpg"
                        alt="Aerial view of Ingress Abbey Wharf and Swanscombe Marshes, Greenhithe, in 1921"
                        width={580}
                        height={493}
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                    <figcaption>
                      <b>Ingress Abbey Wharf and the marshes · 1921</b>
                      <p>
                        The wider Greenhithe landscape during the first decade
                        of the bowls club’s story.{" "}
                        <a
                          href="https://www.britainfromabove.org.uk/en/image/EPW006257"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View the Britain from Above record ↗
                        </a>
                      </p>
                    </figcaption>
                  </figure>
                  <figure className="heritage-photo-card">
                    <a
                      className="heritage-photo-link"
                      href="https://www.britainfromabove.org.uk/en/image/EPW017656"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src="https://britainfromabove.org.uk/sites/all/libraries/aerofilms-images/public/580w/EPW/017/EPW017656.jpg"
                        alt="Aerial view of Empire Paper Mills and Ingress Abbey Wharf, Greenhithe, in 1927"
                        width={580}
                        height={482}
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                    <figcaption>
                      <b>Empire Paper Mills and the wharf · 1927</b>
                      <p>
                        A second archival view of the mill and wharf during the
                        paper-mill era.{" "}
                        <a
                          href="https://www.britainfromabove.org.uk/en/image/EPW017656"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View the Britain from Above record ↗
                        </a>
                      </p>
                    </figcaption>
                  </figure>
                </div>
                <p className="heritage-source-note">
                  Historical reference:{" "}
                  <a
                    href="https://heritage.kent.gov.uk/Monument/MWX17331/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Kent Historic Environment Record
                  </a>
                  . Company details:{" "}
                  <a
                    href="https://find-and-update.company-information.service.gov.uk/company/05434583"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Companies House
                  </a>
                  .
                </p>
              </div>
            </div>
          </details>
          <details open>
            <summary>
              <span>01</span>
              <b>The people of Empire</b>
              <i>+</i>
            </summary>
            <div className="people-grid">
              <div className="committee">
                {committee.map(([role, name, phone]) => (
                  <article key={role}>
                    <b>{role}</b>
                    <span>{name}</span>
                    <a href={`tel:${phone.replaceAll(" ", "")}`}>{phone}</a>
                  </article>
                ))}
              </div>
              <figure className="people-photo">
                <img
                  src="/optimized/club/empire-players.webp"
                  alt="Empire Bowls Club members gathered together on the green"
                  width={1200}
                  height={900}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>Empire bowlers together on the green.</figcaption>
              </figure>
            </div>
          </details>
          <details>
            <summary>
              <span>03</span>
              <b>Achievements</b>
              <i>+</i>
            </summary>
            <div className="achievement-record">
              <p className="achievement-intro">
                Empire’s recent record reaches from local district titles to
                Kent County finals and the Bowls England national stage. These
                highlights combine the club’s published achievement archive
                with county and national competition records, and are shown by
                season so the successes of Empire bowlers are easy to follow.
              </p>

              <section className="achievement-year">
                <div className="achievement-year-head">
                  <span>2026</span>
                  <div>
                    <p className="achievement-kicker">County & national highlights</p>
                    <h3>Empire on the biggest stages</h3>
                  </div>
                </div>
                <ul className="achievement-list">
                  <li>
                    <strong>Kent County Ladies Singles — champion:</strong> Jan
                    Munday defeated Emily Ferguson 21–10 in the county final.
                  </li>
                  <li>
                    <strong>Kent County Ladies Pairs — champions:</strong> Nicky
                    Gausby & Gill Searing defeated Emily Ferguson & Paige Dennis
                    16–14.
                  </li>
                  <li>
                    <strong>Bowls England National Championships:</strong> Jan
                    Munday reached the Women’s Singles National Finals at Royal
                    Leamington Spa, while Nicky Gausby & Gill Searing reached the
                    Women’s Pairs National Finals after winning their Kent title.
                  </li>
                  <li>
                    <strong>All-England Champion of Champions:</strong> Max
                    Fisher reached the national last 16, defeating Alan Morton
                    of Lenham in the last-32 stage.
                  </li>
                </ul>
              </section>

              <section className="achievement-year">
                <div className="achievement-year-head">
                  <span>2025</span>
                  <div>
                    <p className="achievement-kicker">Kent & district success</p>
                    <h3>A season of titles across the region</h3>
                  </div>
                </div>
                <ul className="achievement-list">
                  <li>
                    <strong>Kent County Cox Cup — finalists:</strong> Empire’s
                    ten-player side reached the county final. Jan Munday was a
                    Ladies Singles semi-finalist and Ann Norris a Maude Woods
                    semi-finalist.
                  </li>
                  <li>
                    <strong>Dartford & District champions:</strong> Terry
                    Whiteman, Max Fisher, Richard Gausby & Gary Carpenter won the
                    Men’s Fours; Bruce Woodington & Max Fisher won the Men’s
                    Pairs; Jan Munday won the Ladies Champion of Champions; and
                    Gill Searing & Bruce Woodington won the Mixed Pairs.
                  </li>
                  <li>
                    <strong>Gravesend & District champions:</strong> Terry
                    Whiteman, Sam Turner, Gary Carpenter & Richard Gausby won the
                    Men’s Fours, with Max Fisher also reaching the Men’s Singles
                    and Champion of Champions finals.
                  </li>
                  <li>
                    <strong>North Kent champions:</strong> Bruce Woodington & Max
                    Fisher won the Men’s Pairs; Sam Turner, Richard Gausby & Gary
                    Carpenter won the Men’s Triples; and Sam Turner, Colin
                    Quinton, Gary Carpenter & Richard Gausby won the Men’s Fours.
                  </li>
                  <li>
                    <strong>Bexley Borough Men’s Singles — champion:</strong>{" "}
                    Richard Gausby.
                  </li>
                </ul>
              </section>

              <section className="achievement-year">
                <div className="achievement-year-head">
                  <span>2024</span>
                  <div>
                    <p className="achievement-kicker">District champions</p>
                    <h3>Winning combinations in every section</h3>
                  </div>
                </div>
                <ul className="achievement-list">
                  <li>
                    <strong>Dartford & District:</strong> Bruce Woodington won
                    the Men’s Singles; Ray Norris, Terry Whiteman & Bruce
                    Woodington won the Secretary’s Triples; and Max Fisher was a
                    Men’s Champion of Champions finalist.
                  </li>
                  <li>
                    <strong>Gravesend & District:</strong> Aggie Woodington & Max
                    Fisher won the Mixed Pairs; Max Fisher, Gary Carpenter & Bruce
                    Woodington won the Men’s Triples; Eileen McKinnon, Aggie
                    Woodington & Jan Munday won the Ladies Triples; and Max
                    Fisher, Sam Turner, Gary Carpenter & Bruce Woodington won the
                    Men’s Fours.
                  </li>
                  <li>
                    <strong>Bexley Borough Men’s Pairs — champions:</strong> Bruce
                    Woodington & Max Fisher.
                  </li>
                </ul>
              </section>

              <section className="achievement-year">
                <div className="achievement-year-head">
                  <span>2022</span>
                  <div>
                    <p className="achievement-kicker">National, county & district success</p>
                    <h3>A landmark year for Empire</h3>
                  </div>
                </div>
                <ul className="achievement-list">
                  <li>
                    <strong>Bowls England Family Pairs — area champions:</strong>{" "}
                    Aggie & Bruce Woodington. Aggie Woodington was also a Ladies
                    Champion of Champions area finalist, while Jan Munday was a
                    Ladies Senior Singles area finalist.
                  </li>
                  <li>
                    <strong>Kent County:</strong> Aggie Woodington reached the
                    Ladies Two Bowl Singles semi-final; Max Fisher reached the
                    Men’s Singles quarter-final; and Martin Groombridge & Gary
                    Carpenter reached the Men’s Pairs quarter-final.
                  </li>
                  <li>
                    <strong>Dartford & District champions:</strong> Myrtle
                    Saunders, Aggie Woodington & Jan Munday won the Ladies
                    Triples, while Jan Munday, Dave Munday & Gary Carpenter won
                    the Secretary’s Triples.
                  </li>
                  <li>
                    <strong>Gravesend & District:</strong> Bruce Woodington won
                    the Champion of Champions; and Jan Munday, Dave Munday & Gary
                    Carpenter won the Secretary’s Triples.
                  </li>
                  <li>
                    <strong>Bexley Borough champions:</strong> Bruce Woodington
                    won the Men’s Singles, while Max Fisher, Gary Carpenter &
                    Bruce Woodington won the Men’s Triples.
                  </li>
                  <li>
                    <strong>Team competitions:</strong> Empire reached the
                    divisional final of the Cox Cup and the final of the RACS
                    Knockout Cup.
                  </li>
                </ul>
              </section>

              <p className="achievement-sources">
                <strong>Competition records checked:</strong>{" "}
                <a
                  href="https://www.empirebowlsclub.co.uk/community/empire-bowls-club-14829/2022-club-achievements/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Empire’s published achievement archive
                </a>
                ,{" "}
                <a
                  href="https://www.empirebowlsclub.co.uk/community/empire-bowls-club-14829/2024-club-achievements/"
                  target="_blank"
                  rel="noreferrer"
                >
                  2024 club record
                </a>
                ,{" "}
                <a
                  href="https://www.empirebowlsclub.co.uk/community/empire-bowls-club-14829/2025-club-achievements/"
                  target="_blank"
                  rel="noreferrer"
                >
                  2025 club record
                </a>
                ,{" "}
                <a
                  href="https://www.kcwba.org.uk/index.php/results"
                  target="_blank"
                  rel="noreferrer"
                >
                  Kent County Women’s Bowling Association results
                </a>
                ,{" "}
                <a
                  href="https://www.bowlsenglandcomps.com/competition/fixture/450"
                  target="_blank"
                  rel="noreferrer"
                >
                  Bowls England Women’s Singles finals
                </a>
                , and{" "}
                <a
                  href="https://www.bowlsenglandcomps.com/competition/fixture/451"
                  target="_blank"
                  rel="noreferrer"
                >
                  Women’s Pairs finals
                </a>
                . The Max Fisher national result is recorded by{" "}
                <a
                  href="https://www.lenhambowlingclub.org.uk/Nationals.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Lenham Bowling Club’s 2026 national competition record
                </a>
                .
              </p>
            </div>
          </details>
          <details>
            <summary>
              <span>02</span>
              <b>Club Champions 2025</b>
              <i>+</i>
            </summary>
            <div className="winner-list">
              <p>
                <b>Men’s Championship</b>
                <span>Winner Max Fisher · runner-up Bruce Woodington</span>
              </p>
              <p>
                <b>Ladies Championship</b>
                <span>Winner Jan Munday · runner-up Jenny Hands</span>
              </p>
              <p>
                <b>Men’s Pairs</b>
                <span>
                  Winners Ken Boswell & Gary Carpenter · runners-up Martin
                  Thomas & Bruce Woodington
                </span>
              </p>
              <p>
                <b>Ladies Pairs</b>
                <span>
                  Winners Ann Norris & Elaine Horrigan · runners-up Linda
                  Lawrence & Janet Turner
                </span>
              </p>
              <p>
                <b>Mixed Triples</b>
                <span>
                  Winners Ann Norris, Terry Bland / Geoff Puncheon & Gary
                  Carpenter · runners-up Martin Thomas, Alan Hands & Roger
                  Gladman
                </span>
              </p>
              <p>
                <b>Frost Cup</b>
                <span>
                  Winners Linda Lawrence & Bruce Woodington · runners-up Ken
                  Boswell & Ray Norris
                </span>
              </p>
              <p>
                <b>101</b>
                <span>Winner Max Fisher · runner-up Bruce Woodington</span>
              </p>
              <p>
                <b>Cliff Hunter Handicap</b>
                <span>Winner Richard Gausby · runner-up Max Fisher</span>
              </p>
            </div>
          </details>
        </div>
        <aside className="location-card">
          <p className="eyebrow">Find us</p>
          <h2>Empire Bowls Club</h2>
          <p>
            Norton Lane (off Knockhall Road)
            <br />
            Greenhithe, Kent
            <br />
            DA9 9XY
          </p>
          <hr />
          <p className="small">
            Car park access is via Parkhill Road, entered at the side of 25
            Knockhall Road. Turn right into Norton Lane.
          </p>
        </aside>
      </div>
    </section>
  );
}
function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void fetch("/api/empire/fixtures")
      .then((response) => (response.ok ? response.json() : { fixtures: [] }))
      .then((result) => setFixtures(result.fixtures ?? []))
      .finally(() => setLoaded(true));
  }, []);
  return (
    <section className="page wrap">
      <p className="eyebrow">Fixtures & results</p>
      <h1>Good bowls. Good company.</h1>
      <p className="lead">
        Club sessions, friendlies and competitions are all part of the Empire
        calendar.
      </p>
      {fixtures.length > 0 ? (
        <div className="fixture-list">
          {fixtures.map((fixture) => (
            <article key={fixture.id}>
              <div>
                <span>{fixture.competition}</span>
                <b>{displayDate(fixture.date)} · {fixture.time}</b>
              </div>
              <h2>Empire v {fixture.opponent}</h2>
              <p>
                {fixture.rinkCount} {fixture.rinkCount === 1 ? "rink" : "rinks"} reserved · Please check the members area and club noticeboard for team details and any late changes.
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="fixture-empty" role="status">
          <span>{loaded ? "Seasonal update" : "Loading fixtures"}</span>
          <h2>{loaded ? "No fixtures have been published yet." : "Checking the fixture list…"}</h2>
          <p>{loaded ? fixtureMessage : ""}</p>
        </div>
      )}
      <div className="notice-banner">
        <b>Keep an eye out</b>
        <p>
          When the new season is announced, the full schedule will appear here
          first, with team sheets and availability in the members area.
        </p>
      </div>
    </section>
  );
}
function HonoursPage() {
  return (
    <section className="page wrap">
      <p className="eyebrow">Club honours</p>
      <h1>Celebrating Empire achievement.</h1>
      <p className="lead">
        A record of club and county success, built by generations of Empire
        bowlers.
      </p>
      <div className="honours-grid">
        <article>
          <span>Kent County</span>
          <h2>Cox Cup finalists</h2>
          <p>
            Empire were represented by a strong ten-player side in the Kent
            County Cox Cup final.
          </p>
        </article>
        <article>
          <span>Kent County</span>
          <h2>Singles & Maude Woods</h2>
          <p>
            Jan Munday reached the Ladies Singles semi-final and Ann Norris was
            a Maude Woods semi-finalist.
          </p>
        </article>
        <article>
          <span>Bexley Borough</span>
          <h2>Mixed Fours finalists</h2>
          <p>
            Aggie and Bruce Woodington, Gill Searing and Gary Carpenter reached
            the final.
          </p>
        </article>
      </div>
      <div className="results-board">
        <p className="eyebrow">Club competition winners</p>
        <div>
          <p>
            <b>Men’s Championship</b>
            <span>Max Fisher</span>
          </p>
          <p>
            <b>Ladies Championship</b>
            <span>Jan Munday</span>
          </p>
          <p>
            <b>Men’s Pairs</b>
            <span>Ken Boswell & Gary Carpenter</span>
          </p>
          <p>
            <b>Ladies Pairs</b>
            <span>Ann Norris & Elaine Horrigan</span>
          </p>
        </div>
      </div>
    </section>
  );
}
function PlayBowlsPage({ openPortal }: { openPortal: () => void }) {
  const [sent, setSent] = useState(false);
  const submitEnquiry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    openEmpireEnquiry(new FormData(event.currentTarget));
    setSent(true);
  };
  return (
    <section className="play-page">
      <section className="play-hero">
        <img
          className="play-hero-image"
          src="/optimized/club/empire-bowl-action.webp"
          alt="An Empire Bowls Club member delivering a bowl during a match"
          width={1200}
          height={794}
          fetchPriority="high"
          decoding="async"
        />
        <div className="wrap">
          <p className="eyebrow">Play bowls at Empire</p>
          <h1>
            A great game.
            <br />
            <em>A better welcome.</em>
          </h1>
          <p>
            Step onto one of Kent’s friendliest greens. You do not need
            experience, equipment or anyone to come with — just a little
            curiosity.
          </p>
        </div>
      </section>
      <section className="wrap play-content">
        <div className="play-intro">
          <div>
            <p className="eyebrow">Why try bowls?</p>
            <h2>
              Fresh air, friendly faces and a game you can enjoy for life.
            </h2>
          </div>
          <p>
            Bowls is easy to pick up, but full of rewarding challenges as your
            confidence grows. At Empire, new players can learn at their own pace
            and decide how much they want to get involved.
          </p>
        </div>
        <div className="benefit-grid">
          <article>
            <b>01</b>
            <h3>Beginner friendly</h3>
            <p>
              We will explain the basics, lend you what you need and give you
              time to settle in.
            </p>
          </article>
          <article>
            <b>02</b>
            <h3>Play your way</h3>
            <p>
              Enjoy a relaxed roll-up, our practice sessions, social events or
              competitive fixtures.
            </p>
          </article>
          <article>
            <b>03</b>
            <h3>Part of the club</h3>
            <p>
              Meet people, enjoy the social side and become part of a welcoming
              mixed club.
            </p>
          </article>
        </div>
        <figure className="play-action-feature">
          <img
            src="/optimized/club/empire-bowl-action-crowd.webp"
            alt="An Empire Bowls Club player sending a bowl down the green, with fellow members watching"
            width={1200}
            height={794}
            loading="lazy"
            decoding="async"
          />
          <figcaption>
            <span>Empire in action</span>
            <strong>There is always someone nearby to help you find your line.</strong>
          </figcaption>
        </figure>
        <div className="first-visit">
          <div>
            <p className="eyebrow">Your first session</p>
            <h2>Simple from the moment you arrive.</h2>
            <ol>
              <li>
                <b>Say hello</b>
                <span>We will arrange a convenient, relaxed visit.</span>
              </li>
              <li>
                <b>Have a go</b>
                <span>Try a few bowls with a friendly member beside you.</span>
              </li>
              <li>
                <b>Discover the game</b>
                <span>
                  Learn the mat, delivery and basics at your own pace.
                </span>
              </li>
            </ol>
          </div>
          <aside>
            <p className="eyebrow">Membership</p>
            <h3>Join the Empire family</h3>
            <p>
              <b>Full membership</b>
              <br />
              £90 per year
            </p>
            <p>
              <b>Social membership</b>
              <br />
              £25 per year
            </p>
          </aside>
        </div>
        <div className="enquiry-section">
          <div>
            <p className="eyebrow">Ready when you are</p>
            <h2>Come and try it for yourself.</h2>
            <p>
              Send a short message and Steve will get back to you to arrange a
              friendly introduction.
            </p>
            <a className="email-link" href="mailto:stevewebster@btinternet.com">
              stevewebster@btinternet.com
            </a>
          </div>
          <form onSubmit={submitEnquiry} data-usage-goal="email-handoff" data-usage-ignore="true">
            <label>
              Name
              <input required name="name" />
            </label>
            <label>
              Email
              <input required name="email" type="email" />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" />
            </label>
            <label>
              What would you like to know?
              <textarea
                name="message"
                required
                placeholder="I would like to arrange a first visit…"
              />
            </label>
            <button className="primary" type="submit">Send Enquiry</button>
            <small className="enquiry-help">This will open your email app with your enquiry ready to send.</small>
            {sent && (
              <Status message="Your email app should now be ready to send the enquiry." />
            )}
          </form>
        </div>
        <div className="member-prompt">
          <div>
            <p className="eyebrow">Already a member?</p>
            <h2>Book one of our six rinks online.</h2>
            <p>
              Use the members area to see availability, book a rink, find team
              sheets and view club documents.
            </p>
          </div>
          <button className="primary" onClick={openPortal}>
            Open members area
          </button>
        </div>
      </section>
    </section>
  );
}
function ContactPage() {
  const [sent, setSent] = useState(false);
  const submitContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    openEmpireEnquiry(new FormData(event.currentTarget));
    event.currentTarget.reset();
    setSent(true);
  };
  return (
    <section className="page wrap">
      <p className="eyebrow">Contact & visit</p>
      <h1>Come and see the green.</h1>
      <div className="contact-grid">
        <div className="contact-details">
          <h2>Empire Bowls Club</h2>
          <p>
            Norton Lane (off Knockhall Road)
            <br />
            Greenhithe
            <br />
            Kent
            <br />
            DA9 9XY
          </p>
          <p>
            Car park access is via Parkhill Road, entered at the side of 25
            Knockhall Road. Then turn right into Norton Lane.
          </p>
          <div className="contact-cards">
            <a href="tel:07872111577">
              <span>Phone</span>
              <b>Club secretary</b>
              <small>07872 111577</small>
            </a>
            <a href={`mailto:${EMPIRE_CONTACT_EMAIL}`}>
              <span>Email</span>
              <b>Club secretary</b>
              <small>{EMPIRE_CONTACT_EMAIL}</small>
            </a>
          </div>
        </div>
        <form className="contact-form" onSubmit={submitContact} data-usage-goal="email-handoff" data-usage-ignore="true">
          <p className="eyebrow">Send an enquiry</p>
          <h2>Talk to the club.</h2>
          <p className="form-intro">
            Complete the form and your email app will open with the enquiry
            ready to send to the club secretary.
          </p>
          <label>
            Name
            <input name="name" required maxLength={120} />
          </label>
          <label>
            Email
            <input name="email" type="email" required maxLength={160} />
          </label>
          <label>
            Phone <span>(optional)</span>
            <input name="phone" type="tel" maxLength={40} />
          </label>
          <label>
            How can we help?
            <textarea
              name="message"
              required
              maxLength={2000}
              placeholder="Ask about visiting, membership or club sessions…"
            />
          </label>
          <button className="primary" type="submit">
            Send Enquiry
          </button>
          <small className="enquiry-help">This will open your email app with your enquiry ready to send.</small>
          {sent && (
            <Status message="Your email app should now be ready to send the enquiry." />
          )}
        </form>
      </div>
      <div className="contact-map">
        <div className="contact-map-heading">
          <div>
            <p className="eyebrow">Find the green</p>
            <h2>Plan your visit to Norton Lane.</h2>
          </div>
          <a
            className="map-link"
            href="https://www.google.com/maps/search/?api=1&query=Empire+Bowls+Club+Norton+Lane+Greenhithe+DA9+9XY"
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps <span>↗</span>
          </a>
        </div>
        <div className="map-frame">
          <iframe
            title="Map showing Empire Bowls Club in Greenhithe"
            src="https://www.google.com/maps?q=Empire%20Bowls%20Club%20Norton%20Lane%20Greenhithe%20DA9%209XY&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <p className="map-note">
          Car park access is via Parkhill Road, entered at the side of 25
          Knockhall Road. Turn right into Norton Lane.
        </p>
      </div>
    </section>
  );
}

function Portal({
  access,
  password,
  setAccess,
  setPassword,
}: {
  access: Access | null;
  password: string;
  setAccess: (value: Access | null) => void;
  setPassword: (value: string) => void;
}) {
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const login = async (kind: Access, supplied: string) => {
    setLoggingIn(true);
    setLoginError("");
    try {
      const response = await fetch("/api/empire/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access: kind, password: supplied }),
      });
      const result = await response.json();
      if (!response.ok) {
        setLoginError(result.error || "We could not sign you in. Please try again.");
        return;
      }
      setPassword("");
      setAccess(kind);
    } catch {
      setLoginError("We could not sign you in. Please check your connection and try again.");
    } finally {
      setLoggingIn(false);
    }
  };
  const leave = () => {
    void fetch("/api/empire/auth", { method: "DELETE" });
    setPassword("");
    setAccess(null);
  };
  if (access === "member")
    return <MemberZone password={password} onLeave={leave} />;
  if (access === "admin")
    return <AdminZone password={password} onLeave={leave} />;
  return (
    <main className="portal-shell">
      <section className="portal-intro">
        <p className="eyebrow">Empire online</p>
        <h1>Club access, made simple.</h1>
        <p>
          Members can book a rink, check the latest club information and find
          match availability sheets. Committee members can securely manage these
          updates in the admin area.
        </p>
      </section>
      <section className="login-grid">
        <LoginCard
          title="Members Zone"
          description="Book a rink, see club information and view the member directory."
          passwordHint="Members password"
          busy={loggingIn}
          onLogin={(value) => login("member", value)}
        />
        <LoginCard
          title="Admin Zone"
          description="Add members and publish team sheets, club documents and player-request forms."
          passwordHint="Admin password"
          busy={loggingIn}
          onLogin={(value) => login("admin", value)}
        />
      </section>
      {loginError && <Status type="error" message={loginError} />}
    </main>
  );
}
function LoginCard({
  title,
  description,
  passwordHint,
  busy,
  onLogin,
}: {
  title: string;
  description: string;
  passwordHint: string;
  busy: boolean;
  onLogin: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="login-card"
      onSubmit={(event) => {
        event.preventDefault();
        void onLogin(value);
      }}
    >
      <p className="eyebrow">Private area</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <label>
        {passwordHint}
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          type="password"
          required
          autoComplete="current-password"
          disabled={busy}
        />
      </label>
      <button className="primary" disabled={busy}>{busy ? "Checking access…" : `Enter ${title}`}</button>
    </form>
  );
}

function MemberZone({
  password,
  onLeave,
}: {
  password: string;
  onLeave: () => void;
}) {
  const [date, setDate] = useState(today());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [files, setFiles] = useState<ClubFile[]>([]);
  const [teamSheets, setTeamSheets] = useState<TeamSheet[]>([]);
  const [selected, setSelected] = useState<{
    rink: number;
    slot: string;
  } | null>(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingType, setBookingType] = useState("Roll Up");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [memberTab, setMemberTab] = useState<"club" | "directory">("club");
  const [directorySearch, setDirectorySearch] = useState("");
  const headers = useMemo(() => apiHeaders("member", password), [password]);
  const refresh = useCallback(async () => {
    try {
      const [bookingResponse, memberResponse, fileResponse, teamSheetResponse] = await Promise.all([
        fetch(`/api/empire/bookings?date=${date}`, { headers }),
        fetch("/api/empire/members", { headers }),
        fetch("/api/empire/uploads", { headers }),
        fetch("/api/empire/team-sheets", { headers }),
      ]);
      if (
        !bookingResponse.ok ||
        !memberResponse.ok ||
        !fileResponse.ok ||
        !teamSheetResponse.ok
      ) {
        throw new Error("Member data request failed");
      }
      setBookings((await bookingResponse.json()).bookings ?? []);
      setMembers((await memberResponse.json()).members ?? []);
      setFiles((await fileResponse.json()).files ?? []);
      setTeamSheets((await teamSheetResponse.json()).sheets ?? []);
      setError("");
    } catch {
      setError("We could not refresh the members area. Please try again.");
    }
  }, [date, headers]);
  useEffect(() => {
    const handleUpdate = () => void refresh();
    const timer = window.setTimeout(handleUpdate, 0);
    window.addEventListener(EMPIRE_DATA_UPDATED_EVENT, handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(EMPIRE_DATA_UPDATED_EVENT, handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [refresh]);
  const submitBooking = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setNotice("");
    setError("");
    const bookingLabel = `${bookingName} · ${bookingType}`;
    try {
      const response = await fetch("/api/empire/bookings", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          bookingDate: date,
          rinkNumber: selected.rink,
          timeSlot: selected.slot,
          bookingName: bookingLabel,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "We could not save that booking.");
        return;
      }
      setNotice(
        `Rink ${selected.rink} is booked for ${selected.slot} on ${displayDate(date)}.`,
      );
      setSelected(null);
      setBookingName("");
      setBookingType("Roll Up");
      void refresh();
    } catch {
      setError("We could not save that booking. Please try again.");
    }
  };
  const removeBooking = async (booking: Booking) => {
    if (!window.confirm(`Remove ${booking.bookingName} from this rink?`))
      return;
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/empire/bookings", {
        method: "DELETE",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ id: booking.id }),
      });
      if (!response.ok) {
        setError("We could not remove that booking.");
        return;
      }
      setNotice("The rink booking has been removed.");
      void refresh();
    } catch {
      setError("We could not remove that booking. Please try again.");
    }
  };
  const bookingFor = (rink: number, slot: string) =>
    bookings.find(
      (booking) => booking.rinkNumber === rink && booking.timeSlot === slot,
    );
  const visibleMembers = members.filter((member) =>
    member.name.toLowerCase().includes(directorySearch.trim().toLowerCase()),
  );
  const group = (category: ClubFile["category"]) =>
    files.filter((file) => file.category === category);
  return (
    <main className="portal-shell zone-shell">
      <div className="zone-head">
        <div>
          <p className="eyebrow">Members Zone</p>
          <h1>Welcome to the club.</h1>
          <p>
            Book a rink, see the latest notices and find key club information in
            one place.
          </p>
        </div>
        <button className="outline" type="button" onClick={onLeave}>
          Leave area
        </button>
      </div>
      <section className="booking-panel">
        <div className="booking-head">
          <div>
            <p className="eyebrow">Six-rink booking</p>
            <h2>Choose a free rink and session.</h2>
          </div>
          <label>
            Date
            <input
              type="date"
              min={today()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
        <p className="booking-date">
          Availability for <b>{displayDate(date)}</b>. Personal bookings can be removed here; league fixture rinks are managed in the Admin Zone. Friday green maintenance is protected.
        </p>
        <div className="booking-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                {[1, 2, 3, 4, 5, 6].map((rink) => (
                  <th key={rink}>Rink {rink}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot) => (
                <tr key={slot}>
                  <th>{slot}</th>
                  {[1, 2, 3, 4, 5, 6].map((rink) => {
                    const booking = bookingFor(rink, slot);
                    return (
                      <td key={rink}>
                        <button
                          className={booking ? "taken" : "available"}
                          disabled={booking?.id === null || Boolean(booking?.fixtureKey)}
                          onClick={() => {
                            if (booking && booking.id !== null && !booking.fixtureKey) {
                              void removeBooking(booking);
                            } else {
                              setSelected({ rink, slot });
                              setNotice("");
                              setError("");
                            }
                          }}
                        >
                          {booking ? (
                            <>
                              <b>{booking.bookingName.split(" · ")[0]}</b>
                              <span>
                                {booking.bookingName.split(" · ")[1] ||
                                  "Booked"}{" "}
                                {booking.id === null ? "· Unavailable" : booking.fixtureKey ? "· Fixture booking" : "· Remove"}
                              </span>
                            </>
                          ) : (
                            "Available"
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && (
          <form className="booking-form" onSubmit={submitBooking}>
            <div>
              <b>Rink {selected.rink}</b>
              <span>
                {selected.slot} · {displayDate(date)}
              </span>
            </div>
            <label>
              Your name
              <input
                value={bookingName}
                onChange={(event) => setBookingName(event.target.value)}
                required
                maxLength={100}
              />
            </label>
            <label>
              Booking type
              <select
                value={bookingType}
                onChange={(event) => setBookingType(event.target.value)}
              >
                <option>Roll Up</option>
                <option>League</option>
                <option>Competition</option>
                <option>Neutral</option>
              </select>
            </label>
            <button className="primary">Confirm booking</button>
            <button
              className="text-button"
              type="button"
              onClick={() => setSelected(null)}
            >
              Cancel
            </button>
          </form>
        )}
        {notice && <Status message={notice} />}
        {error && <Status type="error" message={error} />}
      </section>
      <div
        className="member-area-tabs"
        role="tablist"
        aria-label="Members area sections"
      >
        <button
          className={memberTab === "club" ? "active" : ""}
          role="tab"
          aria-selected={memberTab === "club"}
          onClick={() => setMemberTab("club")}
        >
          Club information
        </button>
        <button
          className={memberTab === "directory" ? "active" : ""}
          role="tab"
          aria-selected={memberTab === "directory"}
          onClick={() => setMemberTab("directory")}
        >
          Club directory
        </button>
      </div>
      {memberTab === "club" ? (
        <section className="member-content">
          <TeamSheetsPanel
            sheets={teamSheets}
            legacyFiles={group("team_sheet")}
          />
          <InfoList
            title="Players required"
            description="Let captains know when you are available to play."
            files={group("players_required")}
            password={password}
          />
          <InfoList
            title="Club documents"
            description="Policies, notices and other club information."
            files={group("club_document")}
            password={password}
          />
        </section>
      ) : (
        <section className="directory">
          <div className="directory-head">
            <p className="eyebrow">Member directory</p>
            <h2>Club contact details</h2>
            <p>For members’ use only. Please treat these details with care.</p>
            <label className="directory-search">
              Search by name
              <input
                type="search"
                placeholder="Start typing a member’s name…"
                value={directorySearch}
                onChange={(event) => setDirectorySearch(event.target.value)}
              />
            </label>
          </div>
          <div className="directory-list">
            {visibleMembers.length ? (
              visibleMembers.map((member) => (
                <article key={member.id}>
                  <b>{member.name}</b>
                  <span>{member.membershipType}</span>
                  <a href={`tel:${member.phone.replaceAll(" ", "")}`}>
                    {member.phone}
                  </a>
                  <a href={`mailto:${member.email}`}>{member.email}</a>
                </article>
              ))
            ) : members.length ? (
              <p className="empty">No members match that name.</p>
            ) : (
              <p className="empty">
                The directory will appear here as members are added by the club
                administrator.
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
type PlayerRequest = {
  id: number;
  match: string;
  date: string;
  playersRequired: number;
  names: string[];
};
function PlayerRequestBoard({ password }: { password: string }) {
  const [requests, setRequests] = useState<PlayerRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string[]>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/empire/player-requests", {
        headers: apiHeaders("member", password),
      });
      if (!response.ok) throw new Error("Player request request failed");
      const result = await response.json();
      setRequests(result.requests ?? []);
      setError("");
    } catch {
      setError("We could not load the player requests. Please try again.");
    }
  }, [password]);
  useEffect(() => {
    const handleUpdate = () => void refresh();
    const timer = window.setTimeout(handleUpdate, 0);
    window.addEventListener(EMPIRE_DATA_UPDATED_EVENT, handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(EMPIRE_DATA_UPDATED_EVENT, handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [refresh]);
  const save = async (id: number) => {
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/empire/player-requests", {
        method: "PUT",
        headers: {
          ...apiHeaders("member", password),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id,
          names: drafts[id] ?? requests.find((r) => r.id === id)?.names ?? [],
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "We could not save those names.");
        return;
      }
      if (result.request) {
        setRequests((current) =>
          current.map((request) =>
            request.id === id ? result.request : request,
          ),
        );
      }
      setMessage("Your availability has been saved.");
    } catch {
      setError("We could not save those names. Please try again.");
    }
  };
  return (
    <article className="info-list player-board">
      <h2>Players required</h2>
      <p>Choose an empty space, add your name and click Save names.</p>
      {requests.length ? (
        requests.map((r) => {
          const names = drafts[r.id] ?? r.names;
          return (
            <div className="request-card" key={r.id}>
              <div className="request-card-head">
                <div>
                  <span className="request-card-kicker">Player sign-up</span>
                  <b>{r.match}</b>
                </div>
                <span className="request-card-meta">
                  {r.date} · {r.playersRequired} player
                  {r.playersRequired === 1 ? "" : "s"} required
                </span>
              </div>
              <p className="request-card-help">
                Add your name to an available place, then save your choices.
              </p>
              <div className="player-slots">
                {Array.from({ length: r.playersRequired }, (_, i) => (
                  <label className="player-slot" key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <input
                      aria-label={`Player ${i + 1} name for ${r.match}`}
                      placeholder={`Player ${i + 1}`}
                      value={names[i] ?? ""}
                      onChange={(e) => {
                        const next = [...names];
                        next[i] = e.target.value;
                        setDrafts({ ...drafts, [r.id]: next });
                      }}
                    />
                  </label>
                ))}
              </div>
              <button
                className="primary"
                type="button"
                onClick={() => void save(r.id)}
              >
                Save names
              </button>
            </div>
          );
        })
      ) : (
        <p className="empty">There are no player requests at the moment.</p>
      )}
      {message && <Status message={message} />}
      {error && <Status type="error" message={error} />}
    </article>
  );
}

function TeamSheetsPanel({
  sheets,
  legacyFiles,
}: {
  sheets: TeamSheet[];
  legacyFiles: ClubFile[];
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  return (
    <article className="info-list team-sheets-panel">
      <h2>Team sheets</h2>
      <p>
        Match selections from the captains. Open a match to check the teams and
        see whether you are playing.
      </p>
      {sheets.length ? (
        <div className="team-sheet-list">
          {sheets.map((sheet) => {
            const open = selectedId === sheet.id;
            return (
              <section className="team-sheet-item" key={sheet.id}>
                <button
                  className="team-sheet-card"
                  type="button"
                  aria-expanded={open}
                  onClick={() => setSelectedId(open ? null : sheet.id)}
                >
                  <span className="team-sheet-card-kicker">{sheet.competition}</span>
                  <b>Empire v {sheet.opponent}</b>
                  <span>
                    {displayDate(sheet.matchDate)} · {sheet.rinkCount} rink
                    {sheet.rinkCount === 1 ? "" : "s"}
                  </span>
                  <small>{open ? "Hide team" : "View team"}</small>
                </button>
                {open && (
                  <div className="team-sheet-detail">
                    <h3>Selected teams</h3>
                    <div className="team-sheet-rink-list">
                      {sheet.rinks.map((rink) => (
                        <section className="team-sheet-rink" key={rink.rink}>
                          <div className="team-sheet-rink-head">
                            <b>Rink {rink.rink}</b>
                            <span>{rink.format}</span>
                          </div>
                          <ul>
                            {rink.players.map((player) => (
                              <li key={`${rink.rink}-${player.position}`}>
                                <span>{player.position}</span>
                                <b>{player.name}</b>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <p className="empty">No match team sheets have been published yet.</p>
      )}
      {legacyFiles.length ? (
        <div className="legacy-team-sheets">
          <b>Earlier uploaded team sheets</b>
          <ul>
            {legacyFiles.map((file) => (
              <li key={file.id}>
                <div>
                  <b>{file.title}</b>
                  <span>{file.description || file.fileName}</span>
                </div>
                <a
                  className="open-file"
                  href={`/api/empire/uploads/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function InfoList({
  title,
  description,
  files,
  password,
}: {
  title: string;
  description: string;
  files: ClubFile[];
  password: string;
}) {
  if (title === "Players required")
    return <PlayerRequestBoard password={password} />;
  return (
    <article className="info-list">
      <h2>{title}</h2>
      <p>{description}</p>
      {files.length ? (
        <ul>
          {files.map((file) => (
            <li key={file.id}>
              <div>
                <b>{file.title}</b>
                <span>{file.description || file.fileName}</span>
              </div>
              <a
                className="open-file"
                href={`/api/empire/uploads/${file.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Nothing has been uploaded here yet.</p>
      )}
    </article>
  );
}

function AdminMemberOverview({
  members,
  password,
  onChange,
  onMessage,
}: {
  members: Member[];
  password: string;
  onChange: (members: Member[]) => void;
  onMessage: (message: string) => void;
}) {
  const [sort, setSort] = useState<"name" | "membershipType" | "createdAt">(
    "name",
  );
  const [emailGroup, setEmailGroup] = useState<"all" | "full" | "social">(
    "all",
  );
  const [editing, setEditing] = useState<Member | null>(null);
  const [editError, setEditError] = useState("");
  const ordered = [...members].sort((a, b) => {
    if (sort === "membershipType")
      return (
        a.membershipType.localeCompare(b.membershipType) ||
        a.name.localeCompare(b.name)
      );
    if (sort === "createdAt")
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return a.name.localeCompare(b.name);
  });
  const selectedForEmail = members.filter((member) => {
    if (emailGroup === "full") return member.membershipType === "Full member";
    if (emailGroup === "social")
      return member.membershipType === "Social member";
    return true;
  });
  const copyEmails = async () => {
    const emails = selectedForEmail
      .map((member) => member.email.trim())
      .filter(Boolean)
      .join(", ");
    if (!emails) {
      onMessage("There are no email addresses in that membership group.");
      return;
    }
    try {
      await navigator.clipboard.writeText(emails);
      onMessage(
        `${selectedForEmail.length} ${emailGroup === "all" ? "member" : `${emailGroup} member`} email address${selectedForEmail.length === 1 ? "" : "es"} copied.`,
      );
    } catch {
      onMessage("We could not copy those email addresses. Please try again.");
    }
  };
  const remove = async (member: Member) => {
    if (!window.confirm(`Remove ${member.name} from the member directory?`))
      return;
    const response = await fetch("/api/empire/members", {
      method: "DELETE",
      headers: {
        ...apiHeaders("admin", password),
        "content-type": "application/json",
      },
      body: JSON.stringify({ id: member.id }),
    });
    if (!response.ok) {
      onMessage("We could not remove that member.");
      return;
    }
    onChange(members.filter((item) => item.id !== member.id));
    if (editing?.id === member.id) setEditing(null);
    onMessage(`${member.name} has been removed from the member directory.`);
    notifyEmpireDataUpdated();
  };
  const update = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setEditError("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch("/api/empire/members", {
        method: "PUT",
        headers: {
          ...apiHeaders("admin", password),
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: editing.id, ...values }),
      });
      const result = await response.json();
      if (!response.ok) {
        setEditError(result.error || "We could not update that member.");
        return;
      }
      onChange(
        members.map((member) =>
          member.id === editing.id ? result.member : member,
        ),
      );
      setEditing(null);
      onMessage(`${result.member.name} has been updated in the member directory.`);
      notifyEmpireDataUpdated();
    } catch {
      setEditError("We could not update that member. Please try again.");
    }
  };
  return (
    <details className="admin-members-tab">
      <summary>
        <span className="eyebrow">Member records</span>
        <b>Members overview</b>
        <span className="members-count">{members.length} members</span>
      </summary>
      <div className="admin-members-panel">
        <div className="admin-members-toolbar">
          <p>
            Review the club directory, edit details or remove former members.
          </p>
          <div className="admin-members-controls">
            <label>
              Sort by
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
              >
                <option value="name">Name</option>
                <option value="membershipType">Membership type</option>
                <option value="createdAt">Date joined</option>
              </select>
            </label>
            <label>
              Copy emails for
              <select
                value={emailGroup}
                onChange={(event) =>
                  setEmailGroup(event.target.value as typeof emailGroup)
                }
              >
                <option value="all">All members</option>
                <option value="full">Full members</option>
                <option value="social">Social members</option>
              </select>
            </label>
            <button
              className="copy-emails"
              type="button"
              onClick={() => void copyEmails()}
            >
              Copy {selectedForEmail.length} email
              {selectedForEmail.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
        {ordered.length ? (
          <div className="member-table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Membership</th>
                  <th>Date of birth</th>
                  <th>Date joined</th>
                  <th>Contact</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((member) => (
                  <Fragment key={member.id}>
                    <tr>
                      <td>
                        <b>{member.name}</b>
                      </td>
                      <td>
                        <span
                          className={`member-badge ${member.membershipType === "Social member" ? "social" : "full"}`}
                        >
                          {member.membershipType}
                        </span>
                      </td>
                      <td>{formatDateOfBirth(member.dateOfBirth)}</td>
                      <td>{formatJoinedDate(member.createdAt)}</td>
                      <td>
                        <a href={`mailto:${member.email}`}>{member.email}</a>
                        <a href={`tel:${member.phone.replaceAll(" ", "")}`}>
                          {member.phone}
                        </a>
                      </td>
                      <td className="member-actions">
                        <button
                          className="edit-member"
                          type="button"
                          onClick={() => {
                            setEditing({ ...member, address: member.address ?? "" });
                            setEditError("");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="remove-member"
                          type="button"
                          onClick={() => void remove(member)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                    {editing?.id === member.id && (
                      <tr className="member-edit-row">
                        <td colSpan={6}>
                          <form onSubmit={update}>
                            <div className="member-edit-heading">
                              <b>Edit {member.name}</b>
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => setEditing(null)}
                              >
                                Cancel
                              </button>
                            </div>
                            <div className="form-columns">
                              <label>
                                Full name
                                <input
                                  name="name"
                                  value={editing.name}
                                  onChange={(event) =>
                                    setEditing({ ...editing, name: event.target.value })
                                  }
                                  required
                                  maxLength={120}
                                />
                              </label>
                              <label>
                                Membership type
                                <select
                                  name="membershipType"
                                  value={editing.membershipType}
                                  onChange={(event) =>
                                    setEditing({
                                      ...editing,
                                      membershipType: event.target.value as Member["membershipType"],
                                    })
                                  }
                                >
                                  <option>Full member</option>
                                  <option>Social member</option>
                                </select>
                              </label>
                              <label>
                                Date of birth
                                <input
                                  name="dateOfBirth"
                                  type="date"
                                  value={editing.dateOfBirth ?? ""}
                                  onChange={(event) =>
                                    setEditing({ ...editing, dateOfBirth: event.target.value })
                                  }
                                  max={today()}
                                />
                              </label>
                            </div>
                            <label>
                              Home address
                              <textarea
                                name="address"
                                value={editing.address ?? ""}
                                onChange={(event) =>
                                  setEditing({ ...editing, address: event.target.value })
                                }
                                required
                                maxLength={500}
                              />
                            </label>
                            <div className="form-columns">
                              <label>
                                Phone number
                                <input
                                  name="phone"
                                  type="tel"
                                  value={editing.phone}
                                  onChange={(event) =>
                                    setEditing({ ...editing, phone: event.target.value })
                                  }
                                  required
                                  maxLength={40}
                                />
                              </label>
                              <label>
                                Email address
                                <input
                                  name="email"
                                  type="email"
                                  value={editing.email}
                                  onChange={(event) =>
                                    setEditing({ ...editing, email: event.target.value })
                                  }
                                  required
                                  maxLength={160}
                                />
                              </label>
                            </div>
                            {editError && <Status type="error" message={editError} />}
                            <button className="primary" type="submit">
                              Save member changes
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No members have been added yet.</p>
        )}
      </div>
    </details>
  );
}

function AdminTeamSheetManager({
  members,
  sheets,
  password,
  onChange,
  onMessage,
}: {
  members: Member[];
  sheets: TeamSheet[];
  password: string;
  onChange: (sheets: TeamSheet[]) => void;
  onMessage: (message: string) => void;
}) {
  const blankRink = (format: TeamFormat = "Fours"): TeamSheetDraftRink => ({
    format,
    memberIds: Array.from({ length: teamFormats[format].length }, () => null),
  });
  const [opponent, setOpponent] = useState("");
  const [competition, setCompetition] = useState("");
  const [matchDate, setMatchDate] = useState(today());
  const [rinkCount, setRinkCount] = useState(1);
  const [rinks, setRinks] = useState<TeamSheetDraftRink[]>([blankRink()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const orderedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
  const assignedMemberIds = new Set(
    rinks.flatMap((rink) => rink.memberIds).filter((id): id is number => id !== null),
  );
  const reset = () => {
    setOpponent("");
    setCompetition("");
    setMatchDate(today());
    setRinkCount(1);
    setRinks([blankRink()]);
  };
  const changeRinkCount = (nextCount: number) => {
    setRinkCount(nextCount);
    setRinks((current) =>
      Array.from({ length: nextCount }, (_, index) => current[index] ?? blankRink()),
    );
  };
  const changeFormat = (rinkIndex: number, format: TeamFormat) => {
    setRinks((current) =>
      current.map((rink, index) =>
        index === rinkIndex
          ? {
              format,
              memberIds: Array.from(
                { length: teamFormats[format].length },
                (_, position) => rink.memberIds[position] ?? null,
              ),
            }
          : rink,
      ),
    );
  };
  const changePlayer = (rinkIndex: number, position: number, value: string) => {
    setRinks((current) =>
      current.map((rink, index) => {
        if (index !== rinkIndex) return rink;
        const memberIds = [...rink.memberIds];
        memberIds[position] = value ? Number(value) : null;
        return { ...rink, memberIds };
      }),
    );
  };
  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/empire/team-sheets", {
        method: "POST",
        headers: {
          ...apiHeaders("admin", password),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          opponent,
          competition,
          matchDate,
          rinkCount,
          rinks: rinks.map((rink) => ({
            format: rink.format,
            memberIds: rink.memberIds.map((memberId) => memberId ?? 0),
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The team sheet could not be published.");
        return;
      }
      onChange(
        [...sheets, result.sheet].sort(
          (a, b) =>
            new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime(),
        ),
      );
      reset();
      onMessage(
        `Team sheet for Empire v ${result.sheet.opponent} has been published for members.`,
      );
      notifyEmpireDataUpdated();
    } catch {
      setError("The team sheet could not be published. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (sheet: TeamSheet) => {
    if (!window.confirm(`Remove the team sheet for Empire v ${sheet.opponent}?`)) return;
    setError("");
    try {
      const response = await fetch("/api/empire/team-sheets", {
        method: "DELETE",
        headers: {
          ...apiHeaders("admin", password),
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: sheet.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The team sheet could not be removed.");
        return;
      }
      onChange(sheets.filter((item) => item.id !== sheet.id));
      onMessage(`Team sheet for Empire v ${sheet.opponent} has been removed.`);
      notifyEmpireDataUpdated();
    } catch {
      setError("The team sheet could not be removed. Please try again.");
    }
  };
  return (
    <section className="team-sheet-admin">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">Match selection</p>
          <h2>Create and publish a team sheet</h2>
          <p>
            Choose the match and use the member directory to place players in
            every rink.
          </p>
        </div>
        <span className="members-count">{sheets.length} published</span>
      </div>
      <form className="team-sheet-builder" onSubmit={publish}>
        <div className="form-columns">
          <label>
            Opponent
            <input
              value={opponent}
              onChange={(event) => setOpponent(event.target.value)}
              placeholder="e.g. Greenhithe BC"
              required
              maxLength={160}
            />
          </label>
          <label>
            League or competition
            <input
              value={competition}
              onChange={(event) => setCompetition(event.target.value)}
              placeholder="e.g. North West Kent League"
              required
              maxLength={160}
            />
          </label>
          <label>
            Match date
            <input
              type="date"
              value={matchDate}
              onChange={(event) => setMatchDate(event.target.value)}
              required
            />
          </label>
          <label>
            Number of rinks
            <select
              value={rinkCount}
              onChange={(event) => changeRinkCount(Number(event.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="team-sheet-rinks">
          {rinks.map((rink, rinkIndex) => (
            <section className="team-sheet-rink" key={rinkIndex}>
              <div className="team-sheet-rink-head">
                <b>Rink {rinkIndex + 1}</b>
                <label>
                  Format
                  <select
                    value={rink.format}
                    onChange={(event) =>
                      changeFormat(rinkIndex, event.target.value as TeamFormat)
                    }
                  >
                    {Object.keys(teamFormats).map((format) => (
                      <option key={format}>{format}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="team-sheet-player-grid">
                {teamFormats[rink.format].map((position, positionIndex) => (
                  <label key={position}>
                    {position}
                    <select
                      value={rink.memberIds[positionIndex] ?? ""}
                      onChange={(event) =>
                        changePlayer(rinkIndex, positionIndex, event.target.value)
                      }
                    >
                      <option value="">Choose a member</option>
                      {orderedMembers.map((member) => (
                        <option
                          key={member.id}
                          value={member.id}
                          disabled={
                            assignedMemberIds.has(member.id) &&
                            rink.memberIds[positionIndex] !== member.id
                          }
                        >
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
        {!members.length && (
          <p className="form-note">
            Add members to the directory before building a team sheet.
          </p>
        )}
        {error && <Status type="error" message={error} />}
        <button className="primary" type="submit" disabled={saving || !members.length}>
          {saving ? "Publishing team sheet…" : "Publish team sheet"}
        </button>
      </form>
      {sheets.length ? (
        <div className="published-team-sheets">
          {sheets.map((sheet) => (
            <article key={sheet.id}>
              <div>
                <b>Empire v {sheet.opponent}</b>
                <span>
                  {sheet.competition} · {displayDate(sheet.matchDate)}
                </span>
              </div>
              <button
                className="remove-member"
                type="button"
                onClick={() => void remove(sheet)}
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AdminDocumentOverview({
  files,
  password,
  onChange,
  onMessage,
}: {
  files: ClubFile[];
  password: string;
  onChange: (files: ClubFile[]) => void;
  onMessage: (message: string) => void;
}) {
  const [editing, setEditing] = useState<ClubFile | null>(null);
  const [error, setError] = useState("");
  const ordered = [...files].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setError("");
    try {
      const data = new FormData(event.currentTarget);
      data.set("id", String(editing.id));
      const response = await fetch("/api/empire/uploads", {
        method: "PUT",
        headers: apiHeaders("admin", password),
        body: data,
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The file could not be updated.");
        return;
      }
      onChange(
        files.map((file) => (file.id === editing.id ? result.file : file)),
      );
      setEditing(null);
      onMessage(`${result.file.title} is now updated in the members area.`);
      notifyEmpireDataUpdated();
    } catch {
      setError("The file could not be updated. Please try again.");
    }
  };
  const remove = async (file: ClubFile) => {
    if (!window.confirm(`Remove ${file.title} from the members area?`)) return;
    setError("");
    try {
      const response = await fetch("/api/empire/uploads", {
        method: "DELETE",
        headers: {
          ...apiHeaders("admin", password),
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: file.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The file could not be removed.");
        return;
      }
      onChange(files.filter((item) => item.id !== file.id));
      if (editing?.id === file.id) setEditing(null);
      onMessage(`${file.title} has been removed from the members area.`);
      notifyEmpireDataUpdated();
    } catch {
      setError("The file could not be removed. Please try again.");
    }
  };
  return (
    <details className="admin-files-tab" open>
      <summary>
        <span className="eyebrow">Club documents</span>
        <b>Published documents</b>
        <span className="members-count">{files.length} documents</span>
      </summary>
      <div className="admin-files-panel">
        <p className="admin-panel-help">
          Edit a title or replace a club document and the members area will use
          the new version immediately.
        </p>
        {editing && (
          <form className="file-edit-form" onSubmit={save}>
            <div className="member-edit-heading">
              <b>Edit {editing.title}</b>
              <button
                type="button"
                className="text-button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
            <input type="hidden" name="category" value="club_document" />
            <label>
              Title
              <input
                name="title"
                value={editing.title}
                onChange={(event) =>
                  setEditing({ ...editing, title: event.target.value })
                }
                required
                maxLength={160}
              />
            </label>
            <label>
              Short description
              <textarea
                name="description"
                value={editing.description}
                onChange={(event) =>
                  setEditing({ ...editing, description: event.target.value })
                }
                maxLength={500}
              />
            </label>
            <label>
              Replace file <span className="optional-label">(optional)</span>
              <input
                name="file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              />
              <small>Leave this empty to keep the current file.</small>
            </label>
            {error && <Status type="error" message={error} />}
            <button className="primary" type="submit">
              Save file changes
            </button>
          </form>
        )}
        {ordered.length ? (
          <div className="admin-files-list">
            {ordered.map((file) => (
              <article key={file.id}>
                <div>
                  <b>{file.title}</b>
                  <span>
                    {file.fileName}
                  </span>
                  {file.description && <small>{file.description}</small>}
                </div>
                <button
                  className="edit-member"
                  type="button"
                  onClick={() => {
                    setEditing({ ...file });
                    setError("");
                  }}
                >
                  Edit
                </button>
                <button
                  className="remove-member"
                  type="button"
                  onClick={() => void remove(file)}
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">No club documents have been published yet.</p>
        )}
      </div>
    </details>
  );
}

function AdminPlayerRequestOverview({
  password,
  onMessage,
}: {
  password: string;
  onMessage: (message: string) => void;
}) {
  const [requests, setRequests] = useState<PlayerRequest[]>([]);
  const [editing, setEditing] = useState<PlayerRequest | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/empire/player-requests", {
        headers: apiHeaders("admin", password),
      });
      if (!response.ok) throw new Error("Player request request failed");
      const result = await response.json();
      setRequests(result.requests ?? []);
      setError("");
    } catch {
      setError("We could not load the player sign-up sheets.");
    }
  }, [password]);
  useEffect(() => {
    const handleUpdate = () => void refresh();
    const timer = window.setTimeout(handleUpdate, 0);
    window.addEventListener(EMPIRE_DATA_UPDATED_EVENT, handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(EMPIRE_DATA_UPDATED_EVENT, handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [refresh]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setError("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch("/api/empire/player-requests", {
        method: "PUT",
        headers: {
          ...apiHeaders("admin", password),
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: editing.id, ...values }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The player sign-up sheet could not be updated.");
        return;
      }
      setRequests((current) =>
        current.map((request) =>
          request.id === editing.id ? result.request : request,
        ),
      );
      setEditing(null);
      onMessage(`${result.request.match} has been updated for members.`);
      notifyEmpireDataUpdated();
    } catch {
      setError("The player sign-up sheet could not be updated. Please try again.");
    }
  };
  const remove = async (request: PlayerRequest) => {
    if (!window.confirm(`Remove ${request.match} from the members area?`)) return;
    setError("");
    try {
      const response = await fetch("/api/empire/player-requests", {
        method: "DELETE",
        headers: {
          ...apiHeaders("admin", password),
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: request.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The player sign-up sheet could not be removed.");
        return;
      }
      setRequests((current) => current.filter((item) => item.id !== request.id));
      if (editing?.id === request.id) setEditing(null);
      onMessage(`${request.match} has been removed from the members area.`);
      notifyEmpireDataUpdated();
    } catch {
      setError("The player sign-up sheet could not be removed. Please try again.");
    }
  };
  return (
    <details className="admin-files-tab admin-requests-tab" open>
      <summary>
        <span className="eyebrow">Player availability</span>
        <b>Member sign-up sheets</b>
        <span className="members-count">{requests.length} sheets</span>
      </summary>
      <div className="admin-files-panel">
        <p className="admin-panel-help">
          Changes here are reflected in the Players required section of the
          members area.
        </p>
        {editing && (
          <form className="file-edit-form" onSubmit={save}>
            <div className="member-edit-heading">
              <b>Edit {editing.match}</b>
              <button
                type="button"
                className="text-button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
            <label>
              Match
              <input
                name="match"
                value={editing.match}
                onChange={(event) =>
                  setEditing({ ...editing, match: event.target.value })
                }
                required
                maxLength={160}
              />
            </label>
            <div className="form-columns">
              <label>
                Match date
                <input
                  name="date"
                  type="date"
                  value={editing.date}
                  onChange={(event) =>
                    setEditing({ ...editing, date: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                Players required
                <input
                  name="playersRequired"
                  type="number"
                  min="1"
                  max="40"
                  value={editing.playersRequired}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      playersRequired: Number(event.target.value),
                    })
                  }
                  required
                />
              </label>
            </div>
            {error && <Status type="error" message={error} />}
            <button className="primary" type="submit">
              Save sign-up changes
            </button>
          </form>
        )}
        {requests.length ? (
          <div className="admin-files-list">
            {requests.map((request) => (
              <article key={request.id}>
                <div>
                  <b>{request.match}</b>
                  <span>
                    {request.date} · {request.names.length}/{request.playersRequired} names
                  </span>
                </div>
                <button
                  className="edit-member"
                  type="button"
                  onClick={() => {
                    setEditing({ ...request });
                    setError("");
                  }}
                >
                  Edit
                </button>
                <button
                  className="remove-member"
                  type="button"
                  onClick={() => void remove(request)}
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">No player sign-up sheets have been created yet.</p>
        )}
      </div>
    </details>
  );
}

function formatJoinedDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(parsed);
}

function formatDateOfBirth(value?: string) {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(parsed);
}

function SecuritySettings({
  onMessage,
  onAccessRevoked,
}: {
  onMessage: (message: string) => void;
  onAccessRevoked: () => void;
}) {
  const [access, setAccess] = useState<Access>("member");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Use at least 12 characters for the new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The two new passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/empire/auth", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "We could not update that password.");
        return;
      }
      setPassword("");
      setConfirmPassword("");
      onMessage(`${access === "admin" ? "Admin" : "Members"} password updated. That area will need to sign in again.`);
      if (access === "admin") onAccessRevoked();
    } catch {
      setError("We could not update that password. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="admin-card security-card" onSubmit={updatePassword}>
      <p className="eyebrow">Security</p>
      <h2>Update an access password</h2>
      <p>Use a unique password of at least 12 characters. Changing it signs that area out on other devices.</p>
      <label>
        Area
        <select value={access} onChange={(event) => setAccess(event.target.value as Access)}>
          <option value="member">Members Zone</option>
          <option value="admin">Admin Zone</option>
        </select>
      </label>
      <label>
        New password
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={12} maxLength={256} autoComplete="new-password" required />
      </label>
      <label>
        Confirm new password
        <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" minLength={12} maxLength={256} autoComplete="new-password" required />
      </label>
      {error && <Status type="error" message={error} />}
      <button className="primary" disabled={saving}>{saving ? "Updating…" : "Update password"}</button>
    </form>
  );
}
function NewsAdminPanel({
  password,
  onMessage,
}: {
  password: string;
  onMessage: (message: string) => void;
}) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [error, setError] = useState("");
  const headers = useMemo(() => apiHeaders("admin", password), [password]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/empire/news", { headers });
      if (!response.ok) throw new Error("News request failed");
      setItems((await response.json()).news ?? []);
      setError("");
    } catch {
      setError("We could not load the live stories. Please try again.");
    }
  }, [headers]);
  useEffect(() => {
    const handleUpdate = () => void refresh();
    const timer = window.setTimeout(handleUpdate, 0);
    window.addEventListener(EMPIRE_DATA_UPDATED_EVENT, handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(EMPIRE_DATA_UPDATED_EVENT, handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [refresh]);
  const saveStory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    const form = new FormData(formElement);
    const isEditing = Boolean(editing);
    if (editing) form.set("id", String(editing.id));
    try {
      const response = await fetch("/api/empire/news", {
        method: isEditing ? "PUT" : "POST",
        headers,
        body: form,
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.error ||
            `The news story could not be ${isEditing ? "updated" : "published"}.`,
        );
        return;
      }
      formElement.reset();
      setItems((current) =>
        isEditing
          ? current.map((item) =>
              item.id === result.news.id ? result.news : item,
            )
          : [result.news, ...current],
      );
      setEditing(null);
      onMessage(
        isEditing
          ? `“${result.news.title}” is updated on the News page.`
          : `“${result.news.title}” is now live on the News page.`,
      );
      notifyEmpireDataUpdated();
    } catch {
      setError(
        `The news story could not be ${isEditing ? "updated" : "published"}. Please try again.`,
      );
    }
  };
  const remove = async (id: number) => {
    if (!window.confirm("Remove this story from the News page?")) return;
    try {
      const response = await fetch("/api/empire/news", {
        method: "DELETE",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The news story could not be removed.");
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
      if (editing?.id === id) setEditing(null);
      onMessage("The news story has been removed from the website.");
      notifyEmpireDataUpdated();
    } catch {
      setError("The news story could not be removed. Please try again.");
    }
  };
  return (
    <section className="news-admin">
      <form key={editing?.id ?? "new"} onSubmit={saveStory}>
        <p className="eyebrow">Newsroom</p>
        <div className="news-form-heading">
          <h2>{editing ? "Edit a story" : "Publish a story"}</h2>
          {editing && (
            <button
              type="button"
              className="text-button"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          )}
        </div>
        <p className="form-help">
          {editing
            ? "Update the story and the public News page will use the new version."
            : "Give members and visitors something memorable to discover."}
        </p>
        <label>
          Headline
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={editing?.title ?? ""}
            placeholder="e.g. Empire pair reach the county final"
          />
        </label>
        <div className="form-columns">
          <label>
            News style
            <select
              name="category"
              defaultValue={editing?.category ?? "Club life"}
            >
              <option>Club life</option>
              <option>On the green</option>
              <option>Match day</option>
              <option>Welcome</option>
              <option>Celebration</option>
            </select>
          </label>
          <label>
            Colour mood
            <select name="accent" defaultValue={editing?.accent ?? "gold"}>
              <option value="gold">Empire gold</option>
              <option value="green">Green day</option>
              <option value="red">Club red</option>
              <option value="navy">Navy night</option>
            </select>
          </label>
        </div>
        <label className="news-image-field">
          {editing ? "Replace story image" : "Story image"}
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
          <small>
            {editing
              ? "Leave this empty to keep the current image."
              : "Upload a sharp, high-quality image — avoid blurry, dark or pixelated photos. Landscape images work best."}
          </small>
        </label>
        {editing?.imageUrl && (
          <label className="checkbox-field">
            <input name="removeImage" type="checkbox" />
            Remove the current image
          </label>
        )}
        <label>
          Short introduction
          <textarea
            name="summary"
            required
            maxLength={320}
            defaultValue={editing?.summary ?? ""}
            placeholder="A punchy two-line introduction for the story card."
          />
        </label>
        <label>
          Full story
          <textarea
            name="body"
            required
            maxLength={2000}
            defaultValue={editing?.body ?? ""}
            placeholder="Share the detail, names, score or invitation."
          />
        </label>
        <button className="primary" type="submit">
          {editing ? "Save story changes" : "Publish to News"}
        </button>
        {error && <Status type="error" message={error} />}
      </form>
      <div className="news-admin-list">
        <div className="news-admin-list-head">
          <div>
            <p className="eyebrow">Live stories</p>
            <h3>On the website now</h3>
          </div>
          <span>{items.length}</span>
        </div>
        {items.length ? (
          items.map((item) => (
            <article key={item.id}>
              <span className={`news-admin-icon news-accent-${item.accent}`}>
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  "EB"
                )}
              </span>
              <div>
                <b>{item.title}</b>
                <small>
                  {item.category} · {displayNewsDate(item.publishedAt)}
                </small>
              </div>
              <button
                type="button"
                className="edit-member"
                onClick={() => {
                  setEditing(item);
                  setError("");
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void remove(item.id)}
                aria-label={`Remove ${item.title}`}
              >
                Remove
              </button>
            </article>
          ))
        ) : (
          <p className="empty">No stories published yet.</p>
        )}
      </div>
    </section>
  );
}
function FixtureImportPanel({
  password,
  onMessage,
}: {
  password: string;
  onMessage: (message: string) => void;
}) {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const headers = useMemo(() => apiHeaders("admin", password), [password]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/empire/fixtures", { headers });
      if (!response.ok) throw new Error("Fixture request failed");
      setFixtures((await response.json()).fixtures ?? []);
    } catch {
      setError("We could not load the fixture list.");
    }
  }, [headers]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    const file = new FormData(formElement).get("fixtureFile");
    if (!(file instanceof File) || !file.size) {
      setError("Choose the fixture spreadsheet first.");
      return;
    }
    setBusy(true);
    try {
      const fixtureRows = await parseFixtureSpreadsheet(file);
      const response = await fetch("/api/empire/fixtures", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ fixtures: fixtureRows }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The fixture spreadsheet could not be imported.");
        return;
      }
      formElement.reset();
      onMessage(`${result.imported} ${result.imported === 1 ? "fixture has" : "fixtures have"} been published and the required rinks are reserved.`);
      notifyEmpireDataUpdated();
      await refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The fixture spreadsheet could not be read.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (fixture: Fixture) => {
    if (!window.confirm(`Remove Empire v ${fixture.opponent} on ${displayDate(fixture.date)} and release its rinks?`)) return;
    setError("");
    try {
      const response = await fetch("/api/empire/fixtures", {
        method: "DELETE",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ id: fixture.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The fixture could not be removed.");
        return;
      }
      onMessage(`Empire v ${fixture.opponent} has been removed and its rinks are available again.`);
      notifyEmpireDataUpdated();
      await refresh();
    } catch {
      setError("The fixture could not be removed.");
    }
  };
  return (
    <section className="fixture-import-panel" aria-labelledby="fixture-import-heading">
      <div className="fixture-import-copy">
        <p className="eyebrow">Fixtures</p>
        <h2 id="fixture-import-heading">Import league fixtures</h2>
        <p>Upload one Excel workbook. Every row is checked before anything is added, then the listed rinks are reserved automatically.</p>
      </div>
      <form onSubmit={upload} className="fixture-import-form">
        <label>
          Excel fixture sheet
          <input name="fixtureFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={busy} />
        </label>
        <p className="fixture-import-help">Headings: Date, Time, Opponent, Which League of competition, Which rinks needed. Use a number (for example, 4) for any four free rinks, or a list such as 1, 3, 5 for specific rinks.</p>
        <button className="primary" type="submit" disabled={busy}>{busy ? "Checking fixture sheet…" : "Import fixtures and reserve rinks"}</button>
      </form>
      {error && <Status type="error" message={error} />}
      <div className="fixture-admin-list">
        <div>
          <p className="eyebrow">Published fixtures</p>
          <h3>{fixtures.length ? `${fixtures.length} in the list` : "No fixtures imported yet"}</h3>
        </div>
        {fixtures.length ? (
          <ul>
            {fixtures.map((fixture) => (
              <li key={fixture.id}>
                <div>
                  <b>Empire v {fixture.opponent}</b>
                  <span>{displayDate(fixture.date)} · {fixture.time} · {fixture.competition} · {fixture.rinkCount} {fixture.rinkCount === 1 ? "rink" : "rinks"}</span>
                </div>
                <button type="button" onClick={() => void remove(fixture)}>Remove</button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function AdminZone({
  password,
  onLeave,
}: {
  password: string;
  onLeave: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [files, setFiles] = useState<ClubFile[]>([]);
  const [teamSheets, setTeamSheets] = useState<TeamSheet[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const headers = useMemo(() => apiHeaders("admin", password), [password]);
  const refresh = useCallback(async () => {
    try {
      const [memberResponse, fileResponse, teamSheetResponse] = await Promise.all([
        fetch("/api/empire/members", { headers }),
        fetch("/api/empire/uploads", { headers }),
        fetch("/api/empire/team-sheets", { headers }),
      ]);
      if (!memberResponse.ok || !fileResponse.ok || !teamSheetResponse.ok) {
        throw new Error("Admin data request failed");
      }
      setMembers((await memberResponse.json()).members ?? []);
      setFiles((await fileResponse.json()).files ?? []);
      setTeamSheets((await teamSheetResponse.json()).sheets ?? []);
    } catch {
      setError("We could not load the admin records. Please try again.");
    }
  }, [headers]);
  const adminTabs: Array<{ id: AdminTab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "members", label: "Members", count: members.length },
    { id: "team-sheets", label: "Team sheets", count: teamSheets.length },
    { id: "fixtures", label: "Fixtures" },
    { id: "player-signups", label: "Player sign-ups" },
    { id: "news", label: "News" },
    {
      id: "documents",
      label: "Documents",
      count: files.filter((file) => file.category === "club_document").length,
    },
    { id: "security", label: "Security" },
  ];
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    setError("");
    try {
      const values = Object.fromEntries(new FormData(formElement));
      const response = await fetch("/api/empire/members", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The member could not be added.");
        return;
      }
      formElement.reset();
      setMessage(`${result.member.name} has been added to the member directory.`);
      void refresh();
      notifyEmpireDataUpdated();
    } catch {
      setError("The member could not be added. Please try again.");
    }
  };
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    setError("");
    try {
      const data = new FormData(formElement);
      const response = await fetch("/api/empire/uploads", {
        method: "POST",
        headers,
        body: data,
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The file could not be uploaded.");
        return;
      }
      formElement.reset();
      setMessage(`${result.file.title} has been published for members.`);
      void refresh();
      notifyEmpireDataUpdated();
    } catch {
      setError("The file could not be uploaded. Please try again.");
    }
  };
  const createPlayerRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    setError("");
    try {
      const values = Object.fromEntries(new FormData(formElement));
      const response = await fetch("/api/empire/player-requests", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The player request could not be created.");
        return;
      }
      formElement.reset();
      setMessage(
        `${result.request.match} is ready for members to add their names.`,
      );
      notifyEmpireDataUpdated();
    } catch {
      setError("The player request could not be created. Please try again.");
    }
  };
  return (
    <main className="portal-shell zone-shell admin-zone">
      <div className="zone-head">
        <div>
          <p className="eyebrow">Admin Zone</p>
          <h1>Keep the club informed.</h1>
          <p>
            Add members, publish team selections and keep club documents up to
            date.
          </p>
        </div>
        <button className="outline" type="button" onClick={onLeave}>
          Leave area
        </button>
      </div>
      <section className="admin-summary">
        <article>
          <span>Members</span>
          <b>{members.length}</b>
        </article>
        <article>
          <span>Team sheets</span>
          <b>{teamSheets.length}</b>
        </article>
        <article>
          <span>Club documents</span>
          <b>
            {files.filter((file) => file.category === "club_document").length}
          </b>
        </article>
      </section>
      <div className="admin-tabs">
        <div className="admin-tab-list" role="tablist" aria-label="Admin sections">
          {adminTabs.map((tab) => (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id}`}
              className={`admin-tab${activeTab === tab.id ? " active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`admin-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && <b>{tab.count}</b>}
            </button>
          ))}
        </div>

        <section
          className="admin-tab-panel admin-overview-panel"
          id="admin-panel-overview"
          role="tabpanel"
          aria-labelledby="admin-tab-overview"
          hidden={activeTab !== "overview"}
        >
          <p className="eyebrow">Admin navigation</p>
          <h2>Choose what you want to update.</h2>
          <p>
            Use the tabs above to manage one part of the club website at a time.
            Your changes will continue to appear in the relevant public or members area.
          </p>
        </section>

        <section
          className="admin-tab-panel"
          id="admin-panel-members"
          role="tabpanel"
          aria-labelledby="admin-tab-members"
          hidden={activeTab !== "members"}
        >
          <AdminMemberOverview
            members={members}
            password={password}
            onChange={setMembers}
            onMessage={(nextMessage) => {
              setError("");
              setMessage(nextMessage);
            }}
          />
          <form className="admin-card admin-card-members admin-add-member" onSubmit={addMember}>
            <p className="eyebrow">Member management</p>
            <h2>Add a member</h2>
            <label>
              Full name
              <input name="name" required maxLength={120} />
            </label>
            <label>
              Home address
              <textarea name="address" required maxLength={500} />
            </label>
            <div className="form-columns">
              <label>
                Date of birth
                <input name="dateOfBirth" type="date" required max={today()} />
              </label>
              <label>
                Phone number
                <input name="phone" type="tel" required maxLength={40} />
              </label>
              <label>
                Email address
                <input name="email" type="email" required maxLength={160} />
              </label>
            </div>
            <label>
              Membership type
              <select name="membershipType" defaultValue="Full member">
                <option>Full member</option>
                <option>Social member</option>
              </select>
            </label>
            <button className="primary" type="submit">
              Add member
            </button>
          </form>
        </section>

        <section
          className="admin-tab-panel"
          id="admin-panel-team-sheets"
          role="tabpanel"
          aria-labelledby="admin-tab-team-sheets"
          hidden={activeTab !== "team-sheets"}
        >
          <AdminTeamSheetManager
            members={members}
            sheets={teamSheets}
            password={password}
            onChange={setTeamSheets}
            onMessage={(nextMessage) => {
              setError("");
              setMessage(nextMessage);
            }}
          />
        </section>

        <section
          className="admin-tab-panel"
          id="admin-panel-fixtures"
          role="tabpanel"
          aria-labelledby="admin-tab-fixtures"
          hidden={activeTab !== "fixtures"}
        >
          <FixtureImportPanel
            password={password}
            onMessage={(nextMessage) => {
              setError("");
              setMessage(nextMessage);
            }}
          />
        </section>

        <section
          className="admin-tab-panel"
          id="admin-panel-player-signups"
          role="tabpanel"
          aria-labelledby="admin-tab-player-signups"
          hidden={activeTab !== "player-signups"}
        >
          <AdminPlayerRequestOverview
            password={password}
            onMessage={(nextMessage) => {
              setError("");
              setMessage(nextMessage);
            }}
          />
          <form className="admin-card admin-card-players admin-create-signup" onSubmit={createPlayerRequest}>
            <p className="eyebrow">Player availability</p>
            <h2>Create a player sign-up sheet</h2>
            <label>
              Match
              <input
                name="match"
                placeholder="e.g. League v Greenhithe"
                required
                maxLength={160}
              />
            </label>
            <div className="form-columns">
              <label>
                Match date
                <input name="date" type="date" required />
              </label>
              <label>
                Players required
                <input
                  name="playersRequired"
                  type="number"
                  min="1"
                  max="40"
                  required
                />
              </label>
            </div>
            <button className="primary" type="submit">
              Create sign-up sheet
            </button>
          </form>
        </section>

        <section
          className="admin-tab-panel"
          id="admin-panel-news"
          role="tabpanel"
          aria-labelledby="admin-tab-news"
          hidden={activeTab !== "news"}
        >
          <NewsAdminPanel
            password={password}
            onMessage={(nextMessage) => {
              setError("");
              setMessage(nextMessage);
            }}
          />
        </section>

        <section
          className="admin-tab-panel"
          id="admin-panel-documents"
          role="tabpanel"
          aria-labelledby="admin-tab-documents"
          hidden={activeTab !== "documents"}
        >
          <AdminDocumentOverview
            files={files.filter((file) => file.category === "club_document")}
            password={password}
            onChange={(documents) =>
              setFiles((current) => [
                ...current.filter((file) => file.category !== "club_document"),
                ...documents,
              ])
            }
            onMessage={(nextMessage) => {
              setError("");
              setMessage(nextMessage);
            }}
          />
          <form className="admin-card admin-card-upload admin-upload-document" onSubmit={upload}>
            <p className="eyebrow">Club documents</p>
            <h2>Upload a club document</h2>
            <input type="hidden" name="category" value="club_document" />
            <label>
              Title
              <input name="title" required maxLength={160} />
            </label>
            <label>
              Short description
              <textarea name="description" maxLength={500} />
            </label>
            <label>
              Choose file
              <input
                name="file"
                type="file"
                required
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              />
            </label>
            <button className="primary" type="submit">
              Publish to members area
            </button>
          </form>
        </section>

        <section
          className="admin-tab-panel"
          id="admin-panel-security"
          role="tabpanel"
          aria-labelledby="admin-tab-security"
          hidden={activeTab !== "security"}
        >
          <SecuritySettings
            onAccessRevoked={onLeave}
            onMessage={(nextMessage) => {
              setError("");
              setMessage(nextMessage);
            }}
          />
        </section>
      </div>
      {message && <Status message={message} />}
      {error && <Status type="error" message={error} />}
    </main>
  );
}
