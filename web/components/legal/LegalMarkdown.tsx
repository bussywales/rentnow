import { parseMarkdownToBlocks } from "@/lib/legal/markdown";
import { cn } from "@/components/ui/cn";

export function LegalMarkdown({ content, className }: { content: string; className?: string }) {
  const blocks = parseMarkdownToBlocks(content);

  return (
    <div className={cn("space-y-3 text-sm text-slate-700", className)}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = block.level <= 2 ? "h2" : "h3";
          return (
            <Tag key={`heading-${index}`} className="text-base font-semibold text-slate-900">
              {block.text}
            </Tag>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={`list-${index}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`item-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${index}`} className="leading-relaxed text-slate-700">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
