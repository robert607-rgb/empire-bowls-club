/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://britainfromabove.org.uk",
  // Vinext's server-rendered shell includes its own small inline bootstrap
  // scripts. External script origins remain blocked; the remaining controls
  // still protect against object embedding, framing and rogue connections.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://www.google.com",
  "upgrade-insecure-requests",
].join("; ");

function secureResponse(response: Response, pathname: string) {
  const headers = new Headers(response.headers);
  headers.set("content-security-policy", contentSecurityPolicy);
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("x-permitted-cross-domain-policies", "none");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-origin");
  if (pathname.startsWith("/api/")) {
    headers.set("cache-control", "no-store, max-age=0");
    headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  } else if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    headers.set("cache-control", "public, max-age=300, must-revalidate");
  } else if (
    pathname.startsWith("/optimized/") ||
    pathname === "/favicon.svg" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    // Club artwork and public metadata are versioned by deployment and do not
    // contain member or booking data. Keep them warm between visits without
    // affecting dynamic API responses.
    headers.set("cache-control", "public, max-age=604800, stale-while-revalidate=86400");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Migrate known HugoFox pages directly to their corresponding public page.
    const legacy = url.pathname.match(/^\/community\/empire-bowls-club-14829(?:\/(.*?))?\/?$/i);
    const slug = legacy?.[1]?.replace(/\/$/, "").toLowerCase() ?? "";
    const legacyPages: Record<string, string> = {
      "": "/", "home": "/", "about-us": "/about", "about": "/about", "about-our-club": "/about",
      "the-committee": "/about", "empires-sponsors": "/sponsors",
      "contact": "/contact", "contact-us": "/contact", "news": "/news",
      "fixtures": "/fixtures", "play-bowls": "/play-bowls",
    };
    const legacyTarget = legacy ? (legacyPages[slug] ??
      (/^\d{4}-club-(?:achievements|champions)\d*$/.test(slug) ? "/about" : undefined)) : undefined;
    if ((request.method === "GET" || request.method === "HEAD") && legacyTarget !== undefined) {
      return secureResponse(Response.redirect(`https://empirebowlsclub.co.uk${legacyTarget}${url.search}`, 301), url.pathname);
    }
    if ((request.method === "GET" || request.method === "HEAD") &&
        (url.hostname === "www.empirebowlsclub.co.uk" ||
         (url.hostname === "empirebowlsclub.co.uk" && url.protocol === "http:")) &&
        !url.pathname.startsWith("/api/")) {
      return secureResponse(Response.redirect(`https://empirebowlsclub.co.uk${url.pathname}${url.search}`, 301), url.pathname);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return secureResponse(await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths), url.pathname);
    }

    return secureResponse(await handler.fetch(request, env, ctx), url.pathname);
  },
};

export default worker;
