// Shows text an AI wrote (it writes Markdown: **bold**, lists, links) as real formatting.
// Safe for AI output: raw HTML in the text is shown as text, never run; links open in a new tab.
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "space-y-2 text-sm leading-relaxed break-words",
        "[&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic",
        "[&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
        "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]",
        "[&_h1]:font-heading [&_h1]:text-base [&_h1]:font-bold [&_h2]:font-heading [&_h2]:font-bold [&_h3]:font-semibold",
        "[&_table]:w-full [&_table]:text-left [&_td]:border-t [&_td]:py-1 [&_th]:py-1",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
