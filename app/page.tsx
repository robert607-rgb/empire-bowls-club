"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Access = "member" | "admin";
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
  id: number;
  rinkNumber: number;
  timeSlot: string;
  bookingName: string;
};
type Member = {
  id: number;
  name: string;
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
const fixtures: Array<{ date: string; event: string; type: string }> = [];
const fixtureMessage =
  "The fixtures are taking a winter break — we’ll see you next summer with a full schedule of games!";
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
    strapline: "Professional, caring funeral services for the local community.",
    image: "/sponsors/frost-funeral-service.png",
    website:
      "https://funeral-notices.co.uk/services-directory/view/4589?source=notice",
    linkLabel: "View sponsor information",
    note: "No standalone official website was identified; this opens the local business listing.",
  },
  {
    name: "In Action Bowlswear",
    strapline: "Bowls clothing, equipment and friendly specialist advice.",
    image: "/sponsors/inaction-bowlswear.png",
    website: "https://inactionbowlswear.co.uk/",
    linkLabel: "Visit inactionbowlswear.co.uk",
  },
  {
    name: "Mike’s Maindrain Services",
    strapline: "Drain, sewer and waste services for homes and businesses.",
    image: "/sponsors/mikes-maindrain.png",
    website: "https://www.checkatrade.com/trades/mikesmaindrain",
    linkLabel: "View sponsor profile",
    note: "This opens the company’s verified trade profile.",
  },
  {
    name: "NH Heating Services",
    strapline: "Domestic and commercial heating support across Kent.",
    image: "/sponsors/nh-heating.png",
    website: "https://www.nhheating.co.uk/",
    linkLabel: "Visit nhheating.co.uk",
  },
];
function apiHeaders(access: Access, password: string) {
  return { "x-empire-access": `${access}:${password}` };
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

export default function Home() {
  const [page, setPage] = useState<Page>("Home");
  const [portalOpen, setPortalOpen] = useState(false);
  const [access, setAccess] = useState<Access | null>(null);
  const [password, setPassword] = useState("");
  const openPage = (next: Page) => {
    setPage(next);
    setAccess(null);
    setPortalOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openPortal = () => {
    setAccess(null);
    setPortalOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => openPage("Home")}
          aria-label="Empire Bowls Club home"
        >
          <img src="/empire-crest.png" alt="Empire Bowls Club crest" />
          <span>
            Empire Bowls Club<small>Greenhithe · Kent</small>
          </span>
        </button>
        <nav aria-label="Main navigation">
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
          Members & admin
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
        <img src="/empire-crest.png" alt="" />
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
  useEffect(() => {
    void fetch("/api/empire/news")
      .then((response) => (response.ok ? response.json() : { news: [] }))
      .then((result) => setItems(result.news ?? []));
  }, []);
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
      </div>
      {featured ? (
        <div className={`wrap news-feature news-accent-${featured.accent}`}>
          <div className="news-feature-art">
            <span className="news-stamp">Latest</span>
            {featured.imageUrl ? (
              <img src={featured.imageUrl} alt="" />
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
                    <img src={item.imageUrl} alt="" />
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
      <section className="hero">
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
          </div>
        </div>
        <div className="hero-emblem">
          <img src="/empire-crest.png" alt="Empire Bowls Club crest" />
          <span>EST. 1910</span>
        </div>
      </section>
      <section className="quick-facts wrap single">
        <article>
          <strong>April–September</strong>
          <span>Outdoor playing season</span>
        </article>
      </section>
      <section className="intro-grid wrap">
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
        <div className="green-card">
          <p>
            “A warm welcome, a superb green, and a real sense of belonging.”
          </p>
          <span>Empire Bowls Club</span>
        </div>
      </section>
      <section className="upcoming-section">
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
            {fixtures.length > 0 ? (
              fixtures.map((fixture) => (
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
      <div className="wrap sponsors-intro">
        <p className="eyebrow">Proudly supported</p>
        <h1>The businesses behind Empire.</h1>
        <p className="lead">
          Our sponsors help keep the green thriving. Please support the
          businesses that support our club.
        </p>
      </div>
      <div className="wrap sponsor-grid">
        {sponsors.map((sponsor) => (
          <article className="sponsor-card" key={sponsor.name}>
            <a
              href={sponsor.website}
              target="_blank"
              rel="noreferrer"
              aria-label={`${sponsor.name} website`}
            >
              <img
                src={sponsor.image}
                alt={`${sponsor.name} sponsor artwork`}
              />
              <span>
                Visit sponsor <b>↗</b>
              </span>
            </a>
            <div className="sponsor-card-copy">
              <p className="eyebrow">Empire sponsor</p>
              <h2>{sponsor.name}</h2>
              <p>{sponsor.strapline}</p>
              {sponsor.note && <small>{sponsor.note}</small>}
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
              <span>01</span>
              <b>The Empire story</b>
              <i>+</i>
            </summary>
            <div className="heritage-story">
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
                    paper mill at Greenhithe. At that time, the factory was
                    still associated with the Ingress Abbey Paper Mills
                    operation. The site subsequently became known as Empire
                    Paper Mills, and it was from that later identity that the
                    club took its Empire name.
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
                <article className="heritage-event">
                  <time dateTime="1908">1908</time>
                  <div>
                    <h4>Paper production begins</h4>
                    <p>
                      The Greenhithe site begins producing paper and becomes an
                      increasingly important local employer.
                    </p>
                  </div>
                </article>
                <article className="heritage-event">
                  <time dateTime="1910">1910</time>
                  <div>
                    <h4>The lawn bowls section is formed</h4>
                    <p>
                      People connected with the mill establish a lawn bowls
                      section within the works social club — the beginning of
                      the club we know today.
                    </p>
                  </div>
                </article>
                <article className="heritage-event">
                  <time>1920s</time>
                  <div>
                    <h4>The Empire identity develops</h4>
                    <p>
                      The site becomes associated with the Empire Paper Mills
                      name, giving the bowls club the identity it still carries.
                    </p>
                  </div>
                </article>
                <article className="heritage-event">
                  <time dateTime="1952">1952</time>
                  <div>
                    <h4>A changing paper industry</h4>
                    <p>
                      Empire Paper Mills becomes part of the Reed Group, while
                      the sporting and social life around the green continues.
                    </p>
                  </div>
                </article>
                <article className="heritage-event">
                  <time>Early 1990s</time>
                  <div>
                    <h4>The mill closes — but the bowls club survives</h4>
                    <p>
                      By the early 1990s, the great paper mill that had shaped
                      this part of Greenhithe had finally closed its doors. The
                      industry disappeared, but the club carried its community
                      tradition forward.
                    </p>
                  </div>
                </article>
                <article className="heritage-event">
                  <time dateTime="2005-04-25">2005</time>
                  <div>
                    <h4>Empire Bowls Club Limited</h4>
                    <p>
                      Empire Bowls Club Limited is incorporated on 25 April as
                      a company limited by guarantee. This is the incorporation
                      date of the present legal organisation — not the founding
                      date of the bowls club, which dates back to 1910.
                    </p>
                  </div>
                </article>
                <article className="heritage-event">
                  <time dateTime="2016">2016</time>
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
                <article className="heritage-event">
                  <time>Today</time>
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
                  <p className="heritage-kicker">Archive collection</p>
                  <h3>Help us bring the story to life</h3>
                  <p>
                    These contextual photographs come from established heritage
                    collections. They show the paper mill and the surrounding
                    Greenhithe setting in the period around the club’s early
                    years. They are not presented as photographs of Empire
                    Bowls Club itself.
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
                <div className="heritage-gallery">
                  <div className="archive-placeholder">
                    <span>Archive photograph required</span>
                    <b>Empire Paper Mills, Greenhithe</b>
                  </div>
                  <div className="archive-placeholder">
                    <span>Archive photograph required</span>
                    <b>The former Empire Paper Mills Sports Ground</b>
                  </div>
                  <div className="archive-placeholder">
                    <span>Archive photograph required</span>
                    <b>Early Empire bowlers</b>
                  </div>
                  <div className="archive-placeholder">
                    <span>Archive photograph required</span>
                    <b>Greenhithe and the paper mill community</b>
                  </div>
                  <div className="archive-placeholder">
                    <span>Archive photograph required</span>
                    <b>Empire Bowls Club through the years</b>
                  </div>
                </div>
              </div>
            </div>
          </details>
          <details>
            <summary>
              <span>02</span>
              <b>The people of Empire</b>
              <i>+</i>
            </summary>
            <div className="committee">
              {committee.map(([role, name, phone]) => (
                <article key={role}>
                  <b>{role}</b>
                  <span>{name}</span>
                  <a href={`tel:${phone.replaceAll(" ", "")}`}>{phone}</a>
                </article>
              ))}
            </div>
          </details>
          <details>
            <summary>
              <span>03</span>
              <b>Proud moments</b>
              <i>+</i>
            </summary>
            <div>
              <p>
                <b>Kent County Cox Cup</b> — finalists: Max Fisher, Gary
                Carpenter, Richard Gausby, Roger Gladman, John Horrigan, Dave
                Munday, Ray Norris, Colin Quinton, Terry Whiteman and Bruce
                Woodington.
              </p>
              <p>
                <b>Kent County Ladies Singles</b> — semi-finalist: Jan Munday.{" "}
                <b>Maude Woods</b> — semi-finalist: Ann Norris.
              </p>
              <p>
                <b>Bexley Borough Mixed Fours</b> — finalists: Aggie and Bruce
                Woodington, Gill Searing and Gary Carpenter.
              </p>
              <p>
                <b>Dartford & District</b> — Men’s Fours winners: Terry
                Whiteman, Max Fisher, Richard Gausby and Gary Carpenter; Men’s
                Pairs winners: Bruce Woodington & Max Fisher; Ladies Champion of
                Champions winner: Jan Munday.
              </p>
              <p>
                <b>Gravesend & District</b> — Men’s Singles finalist and
                Champion of Champions finalist: Max Fisher; Men’s Fours winners:
                Terry Whiteman, Sam Turner, Gary Carpenter and Richard Gausby.
              </p>
              <p>
                <b>North Kent</b> — Two Wood Singles finalist: Terry Whiteman;
                Men’s Pairs champions: Bruce Woodington & Max Fisher; Men’s
                Triples champions: Sam Turner, Richard Gausby & Gary Carpenter;
                Men’s Fours champions: Sam Turner, Colin Quinton, Gary Carpenter
                & Richard Gausby.
              </p>
            </div>
          </details>
          <details>
            <summary>
              <span>04</span>
              <b>Empire Champions 2025</b>
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
            <article key={fixture.event}>
              <div>
                <span>{fixture.type}</span>
                <b>{fixture.date}</b>
              </div>
              <h2>{fixture.event}</h2>
              <p>
                Please check the members area and club noticeboard for confirmed
                team details, times and any late changes.
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="fixture-empty" role="status">
          <span>Seasonal update</span>
          <h2>The fixtures are taking a winter break.</h2>
          <p>{fixtureMessage}</p>
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
  return (
    <section className="play-page">
      <section className="play-hero">
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
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSent(true);
            }}
          >
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
                placeholder="I would like to arrange a first visit…"
              />
            </label>
            <button className="primary">Send enquiry</button>
            {sent && (
              <Status message="Thank you — Steve will be in touch soon." />
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
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") ?? "");
    const email = String(values.get("email") ?? "");
    const phone = String(values.get("phone") ?? "");
    const message = String(values.get("message") ?? "");
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : "",
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href = `mailto:stevewebster@btinternet.com?subject=${encodeURIComponent("Empire Bowls Club enquiry")}&body=${encodeURIComponent(body)}`;
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
          </div>
        </div>
        <form className="contact-form" onSubmit={submitContact}>
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
            Prepare enquiry
          </button>
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
  const login = (kind: Access, supplied: string) => {
    const correct = kind === "member" ? "empire" : "empireadmin";
    if (supplied !== correct) {
      setLoginError(
        "That password does not match this area. Please try again.",
      );
      return;
    }
    setPassword(supplied);
    setAccess(kind);
    setLoginError("");
  };
  if (access === "member")
    return <MemberZone password={password} onLeave={() => setAccess(null)} />;
  if (access === "admin")
    return <AdminZone password={password} onLeave={() => setAccess(null)} />;
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
          onLogin={(value) => login("member", value)}
        />
        <LoginCard
          title="Admin Zone"
          description="Add members and publish team sheets, club documents and player-request forms."
          passwordHint="Admin password"
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
  onLogin,
}: {
  title: string;
  description: string;
  passwordHint: string;
  onLogin: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="login-card"
      onSubmit={(event) => {
        event.preventDefault();
        onLogin(value);
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
        />
      </label>
      <button className="primary">Enter {title}</button>
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
  const refresh = async () => {
    const [bookingResponse, memberResponse, fileResponse] = await Promise.all([
      fetch(`/api/empire/bookings?date=${date}`, { headers }),
      fetch("/api/empire/members", { headers }),
      fetch("/api/empire/uploads", { headers }),
    ]);
    if (bookingResponse.ok)
      setBookings((await bookingResponse.json()).bookings);
    if (memberResponse.ok) setMembers((await memberResponse.json()).members);
    if (fileResponse.ok) setFiles((await fileResponse.json()).files);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  const submitBooking = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setNotice("");
    setError("");
    const bookingLabel = `${bookingName} · ${bookingType}`;
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
  };
  const removeBooking = async (booking: Booking) => {
    if (!window.confirm(`Remove ${booking.bookingName} from this rink?`))
      return;
    setNotice("");
    setError("");
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
        <button className="outline" onClick={onLeave}>
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
          Availability for <b>{displayDate(date)}</b>. Click an existing booking
          to remove it.
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
                          onClick={() => {
                            if (booking) {
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
                                · Remove
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
          <InfoList
            title="Team sheets"
            description="The latest match selections published by the committee."
            files={group("team_sheet")}
            password={password}
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
  useEffect(() => {
    void fetch("/api/empire/player-requests", {
      headers: apiHeaders("member", password),
    })
      .then((r) => r.json())
      .then((d) => setRequests(d.requests ?? []));
  }, [password]);
  const save = async (id: number) => {
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
    setMessage(
      response.ok
        ? "Your availability has been saved."
        : "We could not save those names.",
    );
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
              <b>{r.match}</b>
              <span>
                {r.date} · {r.playersRequired} player
                {r.playersRequired === 1 ? "" : "s"} required
              </span>
              {Array.from({ length: r.playersRequired }, (_, i) => (
                <input
                  key={i}
                  placeholder={"Player " + (i + 1)}
                  value={names[i] ?? ""}
                  onChange={(e) => {
                    const next = [...names];
                    next[i] = e.target.value;
                    setDrafts({ ...drafts, [r.id]: next });
                  }}
                />
              ))}
              <button className="primary" onClick={() => void save(r.id)}>
                Save names
              </button>
            </div>
          );
        })
      ) : (
        <p className="empty">There are no player requests at the moment.</p>
      )}
      {message && <Status message={message} />}
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
  const openFile = async (id: number) => {
    const response = await fetch(`/api/empire/uploads/${id}`, {
      headers: apiHeaders("member", password),
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
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
              <button
                className="open-file"
                onClick={() => void openFile(file.id)}
              >
                Open
              </button>
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
    onMessage(`${member.name} has been removed from the member directory.`);
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
            Review the club directory, sort the list and remove former members.
          </p>
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
        </div>
        {ordered.length ? (
          <div className="member-table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Membership</th>
                  <th>Date joined</th>
                  <th>Contact</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((member) => (
                  <tr key={member.id}>
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
                    <td>{formatJoinedDate(member.createdAt)}</td>
                    <td>
                      <a href={`mailto:${member.email}`}>{member.email}</a>
                      <a href={`tel:${member.phone.replaceAll(" ", "")}`}>
                        {member.phone}
                      </a>
                    </td>
                    <td>
                      <button
                        className="remove-member"
                        type="button"
                        onClick={() => void remove(member)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
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
function NewsAdminPanel({
  password,
  onMessage,
}: {
  password: string;
  onMessage: (message: string) => void;
}) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [error, setError] = useState("");
  const headers = useMemo(() => apiHeaders("admin", password), [password]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/empire/news", { headers }).then(async (response) => {
        if (response.ok) setItems((await response.json()).news ?? []);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [password]); // eslint-disable-line react-hooks/exhaustive-deps
  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/empire/news", {
      method: "POST",
      headers,
      body: form,
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "The news story could not be published.");
      return;
    }
    event.currentTarget.reset();
    setItems((current) => [result.news, ...current]);
    onMessage(`“${result.news.title}” is now live on the News page.`);
  };
  const remove = async (id: number) => {
    if (!window.confirm("Remove this story from the News page?")) return;
    const response = await fetch("/api/empire/news", {
      method: "DELETE",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      setError("The news story could not be removed.");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
    onMessage("The news story has been removed from the website.");
  };
  return (
    <section className="news-admin">
      <form onSubmit={publish}>
        <p className="eyebrow">Newsroom</p>
        <h2>Publish a story</h2>
        <p className="form-help">
          Give members and visitors something memorable to discover.
        </p>
        <label>
          Headline
          <input
            name="title"
            required
            maxLength={160}
            placeholder="e.g. Empire pair reach the county final"
          />
        </label>
        <div className="form-columns">
          <label>
            News style
            <select name="category" defaultValue="Club life">
              <option>Club life</option>
              <option>On the green</option>
              <option>Match day</option>
              <option>Welcome</option>
              <option>Celebration</option>
            </select>
          </label>
          <label>
            Colour mood
            <select name="accent" defaultValue="gold">
              <option value="gold">Empire gold</option>
              <option value="green">Green day</option>
              <option value="red">Club red</option>
              <option value="navy">Navy night</option>
            </select>
          </label>
        </div>
        <label className="news-image-field">
          Story image
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
          <small>
            Upload a sharp, high-quality image — avoid blurry, dark or pixelated
            photos. Landscape images work best.
          </small>
        </label>
        <label>
          Short introduction
          <textarea
            name="summary"
            required
            maxLength={320}
            placeholder="A punchy two-line introduction for the story card."
          />
        </label>
        <label>
          Full story
          <textarea
            name="body"
            required
            maxLength={2000}
            placeholder="Share the detail, names, score or invitation."
          />
        </label>
        <button className="primary" type="submit">
          Publish to News
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
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : "EB"}
              </span>
              <div>
                <b>{item.title}</b>
                <small>
                  {item.category} · {displayNewsDate(item.publishedAt)}
                </small>
              </div>
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
function AdminZone({
  password,
  onLeave,
}: {
  password: string;
  onLeave: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [files, setFiles] = useState<ClubFile[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const headers = useMemo(() => apiHeaders("admin", password), [password]);
  const refresh = async () => {
    const [memberResponse, fileResponse] = await Promise.all([
      fetch("/api/empire/members", { headers }),
      fetch("/api/empire/uploads", { headers }),
    ]);
    if (memberResponse.ok) setMembers((await memberResponse.json()).members);
    if (fileResponse.ok) setFiles((await fileResponse.json()).files);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
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
    event.currentTarget.reset();
    setMessage(`${result.member.name} has been added to the member directory.`);
    void refresh();
  };
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const data = new FormData(event.currentTarget);
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
    event.currentTarget.reset();
    setMessage(`${result.file.title} has been published for members.`);
    void refresh();
  };
  const createPlayerRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
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
    event.currentTarget.reset();
    setMessage(
      `${result.request.match} is ready for members to add their names.`,
    );
  };
  return (
    <main className="portal-shell zone-shell admin-zone">
      <div className="zone-head">
        <div>
          <p className="eyebrow">Admin Zone</p>
          <h1>Keep the club informed.</h1>
          <p>
            Add members, upload club information and create live player sign-up
            sheets.
          </p>
        </div>
        <button className="outline" onClick={onLeave}>
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
          <b>{files.filter((file) => file.category === "team_sheet").length}</b>
        </article>
        <article>
          <span>Club documents</span>
          <b>
            {files.filter((file) => file.category === "club_document").length}
          </b>
        </article>
      </section>
      <AdminMemberOverview
        members={members}
        password={password}
        onChange={setMembers}
        onMessage={(nextMessage) => {
          setError("");
          setMessage(nextMessage);
        }}
      />
      <div className="admin-forms">
        <form onSubmit={addMember}>
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
        <form onSubmit={createPlayerRequest}>
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
                max="20"
                required
              />
            </label>
          </div>
          <button className="primary" type="submit">
            Create sign-up sheet
          </button>
        </form>
        <form onSubmit={upload}>
          <p className="eyebrow">Club updates</p>
          <h2>Upload team sheets or documents</h2>
          <label>
            Type of update
            <select name="category" defaultValue="team_sheet">
              <option value="team_sheet">Team sheet</option>
              <option value="club_document">Club document</option>
            </select>
          </label>
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
      </div>
      <NewsAdminPanel
        password={password}
        onMessage={(nextMessage) => {
          setError("");
          setMessage(nextMessage);
        }}
      />
      {message && <Status message={message} />}
      {error && <Status type="error" message={error} />}
    </main>
  );
}
