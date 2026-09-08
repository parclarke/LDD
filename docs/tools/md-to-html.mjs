// Renders a markdown file to a self-contained, Word-friendly HTML document.
// Usage: node md-to-html.mjs <input.md> <output.html> "<Document title>"
import fs from 'node:fs';
import { marked } from 'marked';

const [, , inPath, outPath, titleArg] = process.argv;
const md = fs.readFileSync(inPath, 'utf8');

marked.setOptions({ gfm: true, breaks: false, mangle: false, headerIds: false });

// Mermaid blocks can't render in Word — keep the source as a labelled code block.
let prepared = md.replace(
  /```mermaid\r?\n([\s\S]*?)```/g,
  (_m, body) => '**Diagram (Mermaid source)**\n\n```\n' + body.trimEnd() + '\n```\n'
);

// A GFM table that starts on the line immediately after a list item or paragraph is
// parsed as part of that block, which nests the <table> inside an <li> and makes it
// invisible to the DOCX writer. Force a blank line before every table header row.
prepared = prepared
  .split(/\r?\n/)
  .reduce((out, line, i, all) => {
    const isTableHeader =
      /^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s\-:|]+\|\s*$/.test(all[i + 1] ?? '');
    const prev = out[out.length - 1];
    if (isTableHeader && prev !== undefined && prev.trim() !== '' && !/^\s*\|/.test(prev)) {
      out.push('');
    }
    out.push(line);
    return out;
  }, [])
  .join('\n');

const body = marked.parse(prepared);

const title =
  titleArg ||
  (md.match(/^#\s+(.+)$/m)?.[1] ?? inPath.replace(/\\/g, '/').split('/').pop().replace(/\.md$/, ''));

const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${title.replace(/[<>&]/g, '')}</title>
<style>
  @page { size: 21.0cm 29.7cm; margin: 2cm 2cm 2cm 2cm; }
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 10.5pt; color: #1f1f1f; line-height: 1.35; }
  h1 { font-size: 22pt; color: #0f3b5f; margin: 0 0 12pt; page-break-after: avoid; }
  h2 { font-size: 16pt; color: #0f3b5f; margin: 20pt 0 8pt; page-break-after: avoid; border-bottom: 1px solid #c9d6e2; padding-bottom: 3pt; }
  h3 { font-size: 13pt; color: #14507f; margin: 15pt 0 6pt; page-break-after: avoid; }
  h4 { font-size: 11.5pt; color: #14507f; margin: 12pt 0 5pt; page-break-after: avoid; }
  h5, h6 { font-size: 10.5pt; color: #333; margin: 10pt 0 4pt; page-break-after: avoid; }
  p { margin: 0 0 8pt; }
  ul, ol { margin: 0 0 8pt 0; padding-left: 22pt; }
  li { margin: 0 0 3pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0 14pt; font-size: 9pt; }
  th, td { border: 0.75pt solid #b7c3cf; padding: 4pt 6pt; vertical-align: top; text-align: left; }
  th { background: #eef3f8; color: #0f3b5f; font-weight: 600; }
  tr { page-break-inside: avoid; }
  code { font-family: Consolas, 'Courier New', monospace; font-size: 9pt; background: #f4f4f4; padding: 0 2pt; }
  pre { font-family: Consolas, 'Courier New', monospace; font-size: 8.5pt; background: #f7f7f7;
        border: 0.75pt solid #ddd; padding: 6pt; white-space: pre-wrap; margin: 6pt 0 12pt; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3pt solid #c9d6e2; margin: 6pt 0 10pt; padding: 2pt 0 2pt 10pt; color: #444; }
  hr { border: none; border-top: 0.75pt solid #ccc; margin: 12pt 0; }
  a { color: #14507f; }
</style>
</head>
<body>
${body}
</body>
</html>`;

fs.writeFileSync(outPath, html, 'utf8');
console.log(`${outPath}  (${(html.length / 1024).toFixed(0)} KB)`);
