import { createElement, type ReactNode } from "react";

/**
 * A tiny, dependency-free Markdown renderer for the in-app karmic readings.
 * Supports the subset used by those files: headings (# … ####), horizontal rules,
 * blockquotes, GFM pipe tables, ordered/unordered lists, paragraphs, and inline
 * **bold** / *italic* / [links](url). Light / notebook styling.
 */

// --- Inline formatting -----------------------------------------------------
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-ink">
          {m[1]}
        </strong>,
      );
    } else if (m[2] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{m[2]}</em>);
    } else if (m[3] !== undefined) {
      nodes.push(
        <a key={`${keyPrefix}-a${i}`} href={m[4]} className="text-blue-600 underline">
          {m[3]}
        </a>,
      );
    }
    last = regex.lastIndex;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function splitRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const HEADING_CLASS: Record<number, string> = {
  1: "font-handwriting text-2xl text-ink mt-3 mb-2",
  2: "font-handwriting text-xl text-ink mt-5 mb-2",
  3: "font-semibold text-base text-ink mt-4 mb-1",
  4: "font-semibold text-sm text-ink mt-3 mb-1",
  5: "font-semibold text-sm text-ink mt-3 mb-1",
  6: "font-semibold text-sm text-ink mt-3 mb-1",
};

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="my-4 border-blue-100" />);
      i++;
      continue;
    }

    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      blocks.push(
        createElement(
          `h${Math.min(level, 6)}`,
          { key: key++, className: HEADING_CLASS[level] },
          renderInline(h[2]!, `h${key}`),
        ),
      );
      i++;
      continue;
    }

    // Blockquote (consecutive `>` lines)
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) {
        quote.push(lines[i]!.replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="my-3 border-l-2 border-blue-200 pl-3 text-sm italic text-ink-light"
        >
          {quote.map((q, qi) => (
            <span key={qi} className="block">
              {renderInline(q, `bq${key}-${qi}`)}
            </span>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Table (header row + separator row)
    const next = lines[i + 1];
    if (
      line.trim().startsWith("|") &&
      next !== undefined &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(next) &&
      next.includes("-")
    ) {
      const header = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        rows.push(splitRow(lines[i]!));
        i++;
      }
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {header.map((c, ci) => (
                  <th
                    key={ci}
                    className="border-b border-blue-200 p-1.5 text-left font-semibold text-ink"
                  >
                    {renderInline(c, `th${key}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td
                      key={ci}
                      className="border-b border-blue-50 p-1.5 align-top text-ink-light"
                    >
                      {renderInline(c, `td${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-2 list-disc space-y-1 pl-5 text-sm text-ink-light">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ul${key}-${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-2 list-decimal space-y-1 pl-5 text-sm text-ink-light">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ol${key}-${ii}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph
    blocks.push(
      <p key={key++} className="my-2 text-sm leading-relaxed text-ink-light">
        {renderInline(line, `p${key}`)}
      </p>,
    );
    i++;
  }

  return <div className="text-ink-light">{blocks}</div>;
}
