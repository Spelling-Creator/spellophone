import { execFileSync } from "node:child_process";
import llmstxt from "vitepress-plugin-llms";
import { defineConfig } from "vitepress";

const SITE_ORIGIN = "https://spellophone.spellingcreator.org";
const BASE = "/";

// `lastUpdated` runs `git log` per page and fails the build without a
// repository, which is an ordinary way to build docs (a source tarball, a
// container). Detect it rather than configure it.
function gitHistoryAvailable(): boolean {
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export default defineConfig({
  base: BASE,
  outDir: "../doc_build",
  cleanUrls: true,
  lastUpdated: gitHistoryAvailable(),

  title: "Spellophone",
  description:
    "espeak-ng text-to-speech and phoneme transcription for Node.js and browsers, compiled to WebAssembly.",

  // The same favicon as spellingcreator.org (copied from the Spelling Creator
  // repository into docs/public).
  head: [
    ["link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
    ["link", { rel: "icon", href: "/favicon.ico", sizes: "any" }],
    ["link", { rel: "apple-touch-icon", href: "/apple-touch-icon.png" }],
  ],

  sitemap: {
    hostname: `${SITE_ORIGIN}${BASE}`,
  },

  vite: {
    // Emits llms.txt, llms-full.txt and a Markdown twin of every page.
    plugins: [llmstxt({ domain: SITE_ORIGIN })],
  },

  themeConfig: {
    siteTitle: "Spellophone",
    search: { provider: "local" },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/Spelling-Creator/spellophone",
      },
      { icon: "npm", link: "https://www.npmjs.com/package/spellophone" },
    ],
    editLink: {
      pattern:
        "https://github.com/Spelling-Creator/spellophone/edit/main/apps/docs/docs/:path",
      text: "Edit this page on GitHub",
    },
    footer: {
      message: "Released under the GPL-3.0-or-later license.",
      copyright: `Copyright © ${new Date().getFullYear()} Spelling Creator.`,
    },
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/" },
      {
        text: "Changelog",
        link: "https://github.com/Spelling-Creator/spellophone/blob/main/CHANGELOG.md",
      },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Node.js", link: "/guide/node" },
          { text: "Browsers and workers", link: "/guide/browser" },
          { text: "Languages and data", link: "/guide/languages" },
          { text: "Events, SSML and phonemes", link: "/guide/speech" },
        ],
      },
      {
        text: "API",
        items: [
          { text: "Reference", link: "/api/" },
          { text: "Low-level API", link: "/api/low-level" },
        ],
      },
      {
        text: "Project",
        items: [
          { text: "Building from source", link: "/project/building" },
          { text: "Versioning and releases", link: "/project/releasing" },
          { text: "License", link: "/project/license" },
        ],
      },
    ],
  },
});
