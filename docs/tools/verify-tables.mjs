// Diffs table content between the rendered HTML and the produced .docx so we can
// confirm nothing was silently dropped in conversion.
// Usage: node verify-tables.mjs <file.html> <extracted-docx-document.xml>
import fs from 'node:fs';

const [, , htmlPath, xmlPath] = process.argv;
const html = fs.readFileSync(htmlPath, 'utf8');
const xml = fs.readFileSync(xmlPath, 'utf8');

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const htmlTables = [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => strip(m[0]));
const xmlTables = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map((m) => strip(m[0]));

console.log(`html tables: ${htmlTables.length}`);
console.log(`docx tables: ${xmlTables.length}`);

// Signature = first 60 chars of the flattened table text.
const sig = (t) => t.slice(0, 60);
const docxSigs = new Map();
for (const t of xmlTables) docxSigs.set(sig(t), (docxSigs.get(sig(t)) ?? 0) + 1);

const missing = [];
for (const t of htmlTables) {
  const s = sig(t);
  const n = docxSigs.get(s) ?? 0;
  if (n === 0) missing.push(s);
  else docxSigs.set(s, n - 1);
}

if (missing.length === 0) {
  console.log('All table content present in the .docx.');
} else {
  console.log(`\n${missing.length} table(s) not found in the .docx:`);
  for (const m of missing) console.log(`  - ${m}`);
}

// Also compare total visible text length as a coarse content check.
const htmlText = strip(html.replace(/<style[\s\S]*?<\/style>/g, ''));
const xmlText = strip(xml);
console.log(
  `\ntext length  html=${htmlText.length}  docx=${xmlText.length}  (${((xmlText.length / htmlText.length) * 100).toFixed(1)}%)`
);
