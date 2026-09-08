# LDD documents

Word (.docx) renderings of the Lending Due Diligence design documentation.

| Document | Pages | Tables |
| --- | ---: | ---: |
| `LDD-Requirements-Analysis-Report-v1.0.docx` | 44 | 27 |
| `LDD-Solution-Design-v1.0.docx` | 73 | 35 |
| `LDD-Data-Model-v1.0.docx` | 409 | 315 |

Each document is A4 portrait with a generated table of contents, real Word heading
styles (so the navigation pane works), banded tables and a page-numbered footer.

`source/` holds the markdown originals. `tools/` regenerates the Word files:

```bash
cd docs/tools
npm install
npm run build
```

Then open each `.docx` once in Word and accept the "update fields" prompt, or run
`tools/finalize-docx.ps1 -Dir ..` to populate the table of contents non-interactively.

## Conversion notes

- **Mermaid diagrams** cannot render in Word. `md-to-html.mjs` preserves the diagram
  source as a labelled code block rather than dropping it. The data model contains one
  such diagram.
- **Tables immediately following a list item** are parsed as part of that list in GFM,
  which nests the `<table>` inside an `<li>` and makes it invisible to the DOCX writer.
  `md-to-html.mjs` inserts a blank line before every table header row to prevent this.
- **All seven `margins` keys must be supplied** to `html-to-docx`. Omitted keys are
  written into `w:pgMar` as `undefined`, and Word rejects the resulting package as
  corrupt.

`tools/verify-tables.mjs` diffs the rendered HTML against the produced `document.xml`
to confirm every table survived the conversion.
