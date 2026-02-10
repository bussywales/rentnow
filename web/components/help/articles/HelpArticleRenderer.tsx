import type { ReactNode } from "react";
import { Callout } from "@/components/help/articles/Callout";
import { Steps } from "@/components/help/articles/Steps";
import { YouTube } from "@/components/help/articles/YouTube";
import { ArticleImage } from "@/components/help/articles/Image";

function parseTagAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of line.matchAll(/(\w+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function renderParagraphChunk(lines: string[], key: string): ReactNode {
  const text = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  if (!text) return null;
  return (
    <p key={key} className="text-sm leading-7 text-slate-700">
      {text}
    </p>
  );
}

function renderListBlock(
  lines: string[],
  type: "ul" | "ol",
  key: string
): ReactNode {
  const items = lines
    .map((line) => line.replace(type === "ul" ? /^-\s+/ : /^\d+\.\s+/, "").trim())
    .filter(Boolean);

  if (!items.length) return null;

  if (type === "ul") {
    return (
      <ul key={key} className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-700">
        {items.map((item, index) => (
          <li key={`${key}-${index}`}>{item}</li>
        ))}
      </ul>
    );
  }

  return (
    <ol key={key} className="list-decimal space-y-1 pl-5 text-sm leading-7 text-slate-700">
      {items.map((item, index) => (
        <li key={`${key}-${index}`}>{item}</li>
      ))}
    </ol>
  );
}

function renderInlineBlocks(lines: string[], keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const raw = lines[index] || "";
    const trimmed = raw.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      const start = index;
      const listLines: string[] = [];
      while (index < lines.length && /^-\s+/.test((lines[index] || "").trim())) {
        listLines.push((lines[index] || "").trim());
        index += 1;
      }
      const listNode = renderListBlock(listLines, "ul", `${keyPrefix}-ul-${start}`);
      if (listNode) nodes.push(listNode);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const start = index;
      const listLines: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test((lines[index] || "").trim())) {
        listLines.push((lines[index] || "").trim());
        index += 1;
      }
      const listNode = renderListBlock(listLines, "ol", `${keyPrefix}-ol-${start}`);
      if (listNode) nodes.push(listNode);
      continue;
    }

    const start = index;
    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = (lines[index] || "").trim();
      if (!current || /^-\s+/.test(current) || /^\d+\.\s+/.test(current)) break;
      paragraphLines.push(current);
      index += 1;
    }

    const paragraph = renderParagraphChunk(paragraphLines, `${keyPrefix}-p-${start}`);
    if (paragraph) nodes.push(paragraph);
  }

  return nodes;
}

export function HelpArticleRenderer({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const raw = lines[index] || "";
    const trimmed = raw.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const depth = heading[1].length;
      const text = heading[2].trim();
      const key = `h-${index}`;
      if (depth === 1) {
        nodes.push(
          <h1 key={key} className="text-3xl font-semibold text-slate-900">
            {text}
          </h1>
        );
      } else if (depth === 2) {
        nodes.push(
          <h2 key={key} className="pt-3 text-2xl font-semibold text-slate-900">
            {text}
          </h2>
        );
      } else {
        nodes.push(
          <h3 key={key} className="pt-2 text-lg font-semibold text-slate-900">
            {text}
          </h3>
        );
      }
      index += 1;
      continue;
    }

    if (trimmed.startsWith("<Callout")) {
      const attrs = parseTagAttributes(trimmed);
      const type = attrs.type === "warning" || attrs.type === "success" ? attrs.type : "info";
      const blockLines: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] || "").trim().startsWith("</Callout>")) {
        blockLines.push(lines[index] || "");
        index += 1;
      }
      if (index < lines.length) index += 1;

      nodes.push(
        <Callout key={`callout-${index}`} type={type}>
          <div className="space-y-2">{renderInlineBlocks(blockLines, `callout-${index}`)}</div>
        </Callout>
      );
      continue;
    }

    if (trimmed.startsWith("<Steps>")) {
      const stepLines: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] || "").trim().startsWith("</Steps>")) {
        const current = (lines[index] || "").trim();
        if (current) stepLines.push(current);
        index += 1;
      }
      if (index < lines.length) index += 1;

      const items = stepLines
        .map((line) => line.replace(/^\d+\.\s+/, "").replace(/^-\s+/, "").trim())
        .filter(Boolean)
        .map((line, itemIndex) => <span key={`step-${index}-${itemIndex}`}>{line}</span>);

      nodes.push(<Steps key={`steps-${index}`} items={items} />);
      continue;
    }

    if (trimmed.startsWith("<YouTube")) {
      const attrs = parseTagAttributes(trimmed);
      nodes.push(
        <YouTube
          key={`yt-${index}`}
          id={attrs.id || ""}
          title={attrs.title || "Help video"}
        />
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("<Image")) {
      const attrs = parseTagAttributes(trimmed);
      nodes.push(
        <ArticleImage
          key={`img-${index}`}
          src={attrs.src || ""}
          alt={attrs.alt || "Help image"}
          caption={attrs.caption || ""}
        />
      );
      index += 1;
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      const start = index;
      const listLines: string[] = [];
      while (index < lines.length && /^-\s+/.test((lines[index] || "").trim())) {
        listLines.push((lines[index] || "").trim());
        index += 1;
      }
      const listNode = renderListBlock(listLines, "ul", `ul-${start}`);
      if (listNode) nodes.push(listNode);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const start = index;
      const listLines: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test((lines[index] || "").trim())) {
        listLines.push((lines[index] || "").trim());
        index += 1;
      }
      const listNode = renderListBlock(listLines, "ol", `ol-${start}`);
      if (listNode) nodes.push(listNode);
      continue;
    }

    const start = index;
    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = (lines[index] || "").trim();
      if (
        !current ||
        /^(#{1,6})\s+/.test(current) ||
        current.startsWith("<Callout") ||
        current.startsWith("<Steps>") ||
        current.startsWith("<YouTube") ||
        current.startsWith("<Image") ||
        /^-\s+/.test(current) ||
        /^\d+\.\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    const paragraph = renderParagraphChunk(paragraphLines, `p-${start}`);
    if (paragraph) nodes.push(paragraph);
  }

  return <div className="space-y-4">{nodes}</div>;
}
