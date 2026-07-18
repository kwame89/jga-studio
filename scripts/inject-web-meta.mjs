#!/usr/bin/env node
/**
 * Injects favicon + link-preview (Open Graph / Twitter) tags into the exported
 * web build's index.html.
 *
 * WHY A POST-BUILD STEP INSTEAD OF app/+html.tsx:
 * Expo Router only renders `app/+html.tsx` when `expo.web.output` is "static".
 * This app builds as an SPA (`output` unset, i.e. "single"), where Expo emits
 * its own index.html template and ignores +html.tsx entirely — verified by
 * exporting with a +html.tsx in place and finding none of its tags in the
 * output. So the tags are stitched in here instead.
 *
 * If the app ever moves to `web.output: "static"`, delete this script and move
 * these tags into `app/+html.tsx`, which is the idiomatic home for them.
 *
 * Link-preview scrapers (iMessage, Slack, X, Facebook) do not execute
 * JavaScript — they read the served HTML — which is why setting these from a
 * React screen would not work.
 *
 * og:image MUST be absolute. A relative path silently yields no preview image.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'dist/index.html');

const SITE_URL = 'https://jgastudio.art';
const TITLE = 'JGA Studio';
const DESCRIPTION =
  'The living archive and gallery of artist Jay Golding — every original ' +
  'documented, from the studio to your wall.';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const TAGS = `
    <meta name="description" content="${DESCRIPTION}" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <meta name="theme-color" content="#0B0A0C" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${TITLE}" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESCRIPTION}" />
    <meta property="og:url" content="${SITE_URL}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${TITLE}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${DESCRIPTION}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
`;

if (!existsSync(htmlPath)) {
  console.error(
    `[inject-web-meta] ${htmlPath} not found — run "expo export --platform web" first.`,
  );
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf8');

// Idempotent: re-running (or running after a switch to static rendering, where
// +html.tsx would already have emitted these) must not duplicate the tags.
if (html.includes('property="og:image"')) {
  console.log('[inject-web-meta] og tags already present — nothing to do.');
  process.exit(0);
}

if (!html.includes('</head>')) {
  console.error('[inject-web-meta] no </head> in index.html; refusing to guess.');
  process.exit(1);
}

writeFileSync(htmlPath, html.replace('</head>', `${TAGS}  </head>`), 'utf8');
console.log(`[inject-web-meta] injected preview tags into dist/index.html`);
