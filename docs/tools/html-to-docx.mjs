// Converts the rendered HTML files to .docx without Word automation.
// Usage: node html-to-docx.mjs <sourceDir> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import HTMLtoDOCX from 'html-to-docx';

const [, , sourceDir, outDir] = process.argv;
fs.mkdirSync(outDir, { recursive: true });

const files = fs
  .readdirSync(sourceDir)
  .filter((f) => f.endsWith('.html'))
  .sort((a, b) => fs.statSync(path.join(sourceDir, a)).size - fs.statSync(path.join(sourceDir, b)).size);

for (const file of files) {
  const name = path.basename(file, '.html');
  const started = Date.now();
  process.stdout.write(`Converting ${name} ... `);

  const html = fs.readFileSync(path.join(sourceDir, file), 'utf8');
  const buffer = await HTMLtoDOCX(html, null, {
    orientation: 'portrait',
    pageSize: { width: 11906, height: 16838 }, // A4 in twips
    // All seven margin values must be supplied: html-to-docx writes them straight
    // into w:pgMar, and any omitted key becomes w:header="undefined", which Word
    // rejects as a corrupt package.
    margins: {
      top: 1134,
      right: 1134,
      bottom: 1134,
      left: 1134,
      header: 567,
      footer: 567,
      gutter: 0,
    },
    title: name,
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
    font: 'Segoe UI',
    fontSize: 21, // half-points => 10.5pt
    lineNumber: false,
  });

  const target = path.join(outDir, `${name}.docx`);
  fs.writeFileSync(target, buffer);
  console.log(
    `${(buffer.length / 1024).toFixed(0)} KB in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${target}`
  );
}
