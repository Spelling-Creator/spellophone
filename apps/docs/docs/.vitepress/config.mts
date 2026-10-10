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
      {
        // The package lives on GitHub Packages, not npmjs.com.
        icon: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M8.878.392a1.75 1.75 0 0 0-1.756 0l-5.25 3.045A1.75 1.75 0 0 0 1 4.951v6.098c0 .624.332 1.2.872 1.514l5.25 3.045a1.75 1.75 0 0 0 1.756 0l5.25-3.045c.54-.313.872-.89.872-1.514V4.951c0-.624-.332-1.2-.872-1.514ZM7.875 1.69a.25.25 0 0 1 .25 0l4.63 2.685L8 7.133 3.245 4.375Zm-5.375 4.1 4.75 2.755v5.36L2.622 11.264a.25.25 0 0 1-.122-.216Zm6.25 8.115v-5.36l4.75-2.755v5.258a.25.25 0 0 1-.122.216Z"/></svg>',
        },
        link: "https://github.com/Spelling-Creator/spellophone/pkgs/npm/spellophone",
        ariaLabel: "Package on GitHub Packages",
      },
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
