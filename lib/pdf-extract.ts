import { parseStatementLines } from './statement-pdf';
import type { ParsedStatement } from './statement-pdf';

/**
 * Turning a PDF into lines of text, in the browser.
 *
 * pdf.js hands back positioned text fragments rather than lines -- a single
 * visual row arrives as several items with the same y coordinate. Grouping by
 * that coordinate and then ordering by x reconstructs the row, which is what
 * the statement parser needs to see. Reading straight from `getTextContent()`
 * in item order interleaves columns and produces nonsense on any multi-column
 * page, which every statement has.
 *
 * The library is imported dynamically so its ~1MB does not land in the bundle
 * for anyone who never opens a PDF, and it runs entirely in this browser --
 * the file is never uploaded.
 */

/** Rows within this many units of each other are the same visual line. */
const ROW_TOLERANCE = 2;

export async function extractPdfLines(data: ArrayBuffer): Promise<string[]> {
  /*
   * The legacy build, deliberately. pdf.js's default build calls
   * Map.prototype.getOrInsertComputed -- a proposal-stage API that current
   * Chrome does not have -- and throws on the first document. The legacy build
   * is the same parser transpiled for browsers that exist today.
   *
   * scripts/copy-pdf-worker.mjs copies the matching legacy worker into
   * public/. Main thread and worker must come from the same build.
   */
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  // Keep the loading task: teardown lives on it, not on the document proxy.
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;

  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    const rows: { y: number; items: { x: number; text: string }[] }[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const x = item.transform[4] as number;
      const y = item.transform[5] as number;
      const existing = rows.find((row) => Math.abs(row.y - y) <= ROW_TOLERANCE);
      if (existing) existing.items.push({ x, text: item.str });
      else rows.push({ y, items: [{ x, text: item.str }] });
    }

    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      const text = row.items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) lines.push(text);
    }
  }

  // Statements are small, but the worker holds the whole document until this
  // runs, and someone importing a year of them would notice.
  await task.destroy();
  return lines;
}

export async function parsePdfStatement(data: ArrayBuffer): Promise<ParsedStatement> {
  return parseStatementLines(await extractPdfLines(data));
}
