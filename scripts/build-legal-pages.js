#!/usr/bin/env node
/**
 * Renders legal/*.md into two things, from one source:
 *
 *   docs/*.html                  the hosted pages the stores and AdMob link to
 *   src/constants/legalContent.ts   the same text, for the in-app screen
 *
 *   npm run legal
 *
 * The in-app copy exists so the policy renders natively — themed, readable
 * offline, and without a browser chrome showing a domain. Generating both from
 * the same Markdown is the point: a hosted policy that disagrees with the one
 * in the app is worse than having only one of them.
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

/**
 * Terms of Use is deliberately not published.
 *
 * Neither store requires one, and Apple applies its Standard EULA when an app
 * supplies no custom terms. This game has no accounts, no user content and no
 * purchases, so there is nothing a custom agreement would usefully say.
 * `legal/terms-of-use.md` is kept in the repo in case that changes.
 */
const PAGES = [{ src: 'privacy-policy.md', out: 'privacy.html', title: 'Privacy Policy' }];

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Bold, links, and bare URLs — everything these documents actually use. */
function inline(text) {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s)]+)/g, '$1<a href="$2">$2</a>');
}

/**
 * Markdown -> a small block tree.
 *
 * One parser feeds both outputs. Writing a second one for the app would let the
 * hosted policy and the in-app policy drift apart, which for a legal document
 * is the one failure that actually matters.
 *
 * Supports exactly what these documents use: headings, bullets, paragraphs that
 * wrap across source lines, and bold. Anything else passes through as text.
 */
function parse(markdown) {
  // Strip HTML comments: they carry instructions for whoever publishes the page,
  // not content for the reader.
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const blocks = [];
  let inList = false;
  /**
   * Markdown paragraphs wrap across source lines and are only ended by a blank
   * line. Emitting one block per line splits sentences mid-clause with a gap in
   * the middle — which is exactly how the first render came out.
   */
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const closeBlocks = () => {
    flushParagraph();
    inList = false;
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
      blocks.push({ kind: `h${heading[1].length}`, text: heading[2] });
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      inList = true;
      blocks.push({ kind: 'li', text: bullet[1] });
      continue;
    }

    // A wrapped continuation of the current list item, not a new paragraph.
    if (inList) {
      blocks[blocks.length - 1].text += ` ${trimmed}`;
      continue;
    }

    paragraph.push(trimmed);
  }
  closeBlocks();
  return blocks;
}

/** Split a line into plain and bold runs, for renderers that need the pieces. */
function spans(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length > 0 ? out : [{ text }];
}

function toHtml(markdown) {
  const out = [];
  let inList = false;
  for (const block of parse(markdown)) {
    if (block.kind === 'li') {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(block.text)}</li>`);
      continue;
    }
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
    if (block.kind === 'p') out.push(`<p>${inline(block.text)}</p>`);
    else out.push(`<${block.kind}>${inline(block.text)}</${block.kind}>`);
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

/** The same blocks, as a TypeScript module the app imports. */
function toTypeScript(markdown, sourceFile) {
  const blocks = parse(markdown).map((b) => ({ kind: b.kind, spans: spans(b.text) }));
  const updated = (markdown.match(/Last updated:\s*([^*\n]+)/) ?? [, ''])[1].trim();
  const body = blocks
    .map((b) => {
      const parts = b.spans
        .map((s) => (s.bold ? `{ text: ${JSON.stringify(s.text)}, bold: true }` : `{ text: ${JSON.stringify(s.text)} }`))
        .join(', ');
      return `  { kind: '${b.kind}', spans: [${parts}] },`;
    })
    .join('\n');

  return `/**
 * GENERATED FILE — do not edit.
 *
 * Built from legal/${sourceFile} by scripts/build-legal-pages.js (\`npm run legal\`),
 * which renders the same source to docs/privacy.html. Edit the Markdown and
 * re-run; editing this file loses the change on the next build and puts the
 * app out of step with the hosted policy.
 */

export type LegalSpan = { text: string; bold?: boolean };

export type LegalBlock = {
  kind: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'li';
  spans: LegalSpan[];
};

/** Shown in the app so a reader can tell which revision they are looking at. */
export const PRIVACY_UPDATED = ${JSON.stringify(updated)};

export const PRIVACY_POLICY: readonly LegalBlock[] = [
${body}
];
`;
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

  if (page.src === 'privacy-policy.md') {
    const tsPath = path.join(root, 'src', 'constants', 'legalContent.ts');
    fs.writeFileSync(tsPath, toTypeScript(markdown, page.src));
    console.log('  ✓ src/constants/legalContent.ts');
  }
}

const index = shell(
  'Pulse Blocks',
  `<h1>Pulse Blocks</h1>
<p>Legal documents for the Pulse Blocks mobile game.</p>
<ul>
  <li><a href="./privacy.html">Privacy Policy</a></li>
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
