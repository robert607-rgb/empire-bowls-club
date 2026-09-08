import { access, cp, mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      // Cache only content-hashed public files. Pages, APIs and member data keep their existing policy.
      const client = resolve(root, "dist", "client");
      if (await exists(client)) {
        const rules = ["/usage-assets/*\n  Cache-Control: public, max-age=31536000, immutable"];
        async function collect(directory: string, prefix: string) {
          for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = `${prefix}/${entry.name}`;
            if (entry.isDirectory()) await collect(resolve(directory, entry.name), path);
            else if (/-[A-Za-z0-9_-]{8}\.(?:js|css|woff2?)$/.test(entry.name)) {
              rules.push(`${path}\n  Cache-Control: public, max-age=31536000, immutable`);
            }
          }
        }
        await collect(client, "");
        await writeFile(resolve(client, "_headers"), rules.join("\n\n") + "\n");
      }
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }
    },
  };
}
