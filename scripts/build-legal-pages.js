#!/usr/bin/env node
/**
 * Renders legal/*.md into docs/ as standalone HTML for GitHub Pages.
 *
 *   npm run legal
 *
 * GitHub Pages can render Markdown itself, but only with a Jekyll theme and a
 * repo configured for it. Plain HTML always works, needs no build on GitHub's
 * side, and looks the same whether it is served from Pages, S3 or a static host —
 * which matters because these URLs go into two store listings and an AdMob
 * account, and changing them later means editing all three.
 *
 * Deliberately dependency-free: a converter for the small Markdown subset these
 * two documents use, rather than pulling a library into the project for it.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'legal');
const outDir = path.join(root, 'docs');

const PAGES = [
  { src: 'privacy-policy.md', out: 'privacy.html', title: 'Privacy Policy' },
  { src: 'terms-of-use.md', out: 'terms.html', title: 'Terms of Use' },
];

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Bold, links, and bare URLs — everything these documents actually use. */
function inline(text) {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s)]+)/g, '$1<a href="$2">$2</a>');
}

function toHtml(markdown) {
  // Strip HTML comments: they carry instructions for whoever publishes the page,
  // not content for the reader.
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const out = [];
  let inList = false;
  /**
   * Markdown paragraphs wrap across source lines and are only ended by a blank
   * line. Emitting one <p> per line splits sentences mid-clause with a paragraph
   * gap in the middle — which is exactly how the first render came out.
   */
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  const closeBlocks = () => {
    flushParagraph();
    closeList();
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      closeBlocks();
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeBlocks();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    // A wrapped continuation of the current list item, not a new paragraph.
    if (inList) {
      const last = out.length - 1;
      out[last] = out[last].replace(/<\/li>$/, ` ${inline(trimmed)}</li>`);
      continue;
    }

    paragraph.push(trimmed);
  }
  closeBlocks();
  return out.join('\n');
}

const shell = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Pulse Blocks</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0 auto; padding: 2rem 1.25rem 4rem; max-width: 42rem;
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #14161c; background: #fff;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e7e9ee; background: #0b0d13; }
    a { color: #6ee7d0; }
  }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .5rem; }
  h2 { font-size: 1.25rem; margin: 2.25rem 0 .5rem; }
  h3 { font-size: 1.05rem; margin: 1.75rem 0 .5rem; }
  ul { padding-left: 1.25rem; }
  li { margin: .35rem 0; }
  a { color: #0a7f6b; }
  footer { margin-top: 3rem; font-size: .875rem; opacity: .7; }
</style>
</head>
<body>
${body}
<footer><a href="./">All Pulse Blocks documents</a></footer>
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });

let unresolved = 0;
for (const page of PAGES) {
  const markdown = fs.readFileSync(path.join(srcDir, page.src), 'utf8');
  const placeholders = markdown.match(/\{\{[A-Z_]+\}\}/g) ?? [];
  if (placeholders.length > 0) {
    unresolved += placeholders.length;
    console.warn(`  ! ${page.src} still contains ${[...new Set(placeholders)].join(', ')}`);
  }
  fs.writeFileSync(path.join(outDir, page.out), shell(page.title, toHtml(markdown)));
  console.log(`  ✓ docs/${page.out}`);
}

const index = shell(
  'Pulse Blocks',
  `<h1>Pulse Blocks</h1>
<p>Legal documents for the Pulse Blocks mobile game.</p>
<ul>
  <li><a href="./privacy.html">Privacy Policy</a></li>
  <li><a href="./terms.html">Terms of Use</a></li>
</ul>`,
);
fs.writeFileSync(path.join(outDir, 'index.html'), index);
console.log('  ✓ docs/index.html');

// Stops GitHub Pages running the files through Jekyll, which would ignore any
// file or directory beginning with an underscore.
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

if (unresolved > 0) {
  console.error(`\n${unresolved} placeholder(s) still unresolved — fill them in before publishing.\n`);
  process.exit(1);
}
console.log('\nDone. Enable GitHub Pages on this repo with source "main /docs".\n');
