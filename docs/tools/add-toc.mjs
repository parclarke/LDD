// Injects a "Contents" heading plus a TOC field at the start of a .docx, then a page
// break. Word populates the field on open (it is flagged dirty), which keeps the file
// valid without needing Word automation to build the entries.
// Usage: node add-toc.mjs <dir-of-docx>
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

const dir = process.argv[2];

const P = (styleId, runs) =>
  `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>${runs}</w:p>`;

const tocParagraphs = [
  P('Heading1', '<w:r><w:t xml:space="preserve">Contents</w:t></w:r>'),
  // Field: begin -> instruction -> separate -> placeholder -> end
  '<w:p>' +
    '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>' +
    '<w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r>' +
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
    '<w:r><w:t xml:space="preserve">Right-click and choose "Update Field" to build the table of contents.</w:t></w:r>' +
    '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
    '</w:p>',
  '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
].join('');

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.docx'))) {
  const full = path.join(dir, file);
  const zip = new AdmZip(full);
  const entry = zip.getEntry('word/document.xml');
  let xml = zip.readAsText(entry);

  if (xml.includes('TOC \\o')) {
    console.log(`${file}: TOC already present, skipped`);
    continue;
  }

  const bodyOpen = xml.indexOf('<w:body>');
  if (bodyOpen === -1) throw new Error(`${file}: no <w:body> found`);
  const insertAt = bodyOpen + '<w:body>'.length;
  xml = xml.slice(0, insertAt) + tocParagraphs + xml.slice(insertAt);

  // Ask Word to refresh fields when the document opens.
  const settingsEntry = zip.getEntry('word/settings.xml');
  if (settingsEntry) {
    let settings = zip.readAsText(settingsEntry);
    if (!settings.includes('w:updateFields')) {
      settings = settings.replace(
        /(<w:settings[^>]*>)/,
        '$1<w:updateFields w:val="true"/>'
      );
      zip.updateFile(settingsEntry, Buffer.from(settings, 'utf8'));
    }
  }

  zip.updateFile(entry, Buffer.from(xml, 'utf8'));
  zip.writeZip(full);
  console.log(`${file}: TOC field added`);
}
