/// <reference types="vite/client" />

type D1Database = import("@cloudflare/workers-types").D1Database;
type D1PreparedStatement = import("@cloudflare/workers-types").D1PreparedStatement;
type R2Bucket = import("@cloudflare/workers-types").R2Bucket;
type Fetcher = { fetch(request: Request): Promise<Response> };

declare module "cloudflare:workers" {
  export const env: { DB: D1Database; BUCKET: R2Bucket };
}
