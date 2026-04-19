"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: ({ children, ...rest }) => (
    <p className="mb-2.5 last:mb-0 leading-relaxed" {...rest}>
      {children}
    </p>
  ),
  ul: ({ children, ...rest }) => (
    <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0" {...rest}>
      {children}
    </ul>
  ),
  ol: ({ children, ...rest }) => (
    <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0" {...rest}>
      {children}
    </ol>
  ),
  li: ({ children, ...rest }) => (
    <li className="leading-relaxed" {...rest}>
      {children}
    </li>
  ),
  h1: ({ children, ...rest }) => (
    <h1 className="mb-2 mt-1 text-lg font-semibold text-white" {...rest}>
      {children}
    </h1>
  ),
  h2: ({ children, ...rest }) => (
    <h2 className="mb-2 mt-3 text-base font-semibold text-white/95 first:mt-0" {...rest}>
      {children}
    </h2>
  ),
  h3: ({ children, ...rest }) => (
    <h3 className="mb-1.5 mt-2 text-[15px] font-semibold text-white/90" {...rest}>
      {children}
    </h3>
  ),
  a: ({ children, href, ...rest }) => (
    <a
      href={href}
      className="font-medium text-[#7dd3fc] underline decoration-[#7dd3fc]/40 underline-offset-2 hover:text-[#a5f3fc]"
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...rest }) => (
    <blockquote
      className="mb-2.5 border-l-2 border-white/20 pl-3 text-white/75 italic last:mb-0"
      {...rest}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...rest }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code className={`block rounded-lg bg-black/55 p-3 text-[13px] text-[#e2e8f0] ${className ?? ""}`} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[13px] text-[#a5f3fc]"
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...rest }) => (
    <pre className="mb-3 max-w-full overflow-x-auto rounded-xl border border-white/[0.08] bg-black/50 p-0 last:mb-0" {...rest}>
      {children}
    </pre>
  ),
  table: ({ children, ...rest }) => (
    <div className="mb-3 max-w-full overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-left text-[13px]" {...rest}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...rest }) => (
    <th className="border border-white/15 bg-white/[0.06] px-2 py-1.5 font-semibold text-white/90" {...rest}>
      {children}
    </th>
  ),
  td: ({ children, ...rest }) => (
    <td className="border border-white/10 px-2 py-1.5 text-white/80" {...rest}>
      {children}
    </td>
  ),
};

type Props = {
  text: string;
  className?: string;
};

/** ChatGPT-style markdown for assistant replies (GFM: tables, lists, links). */
export function ChatMarkdown({ text, className = "" }: Props) {
  return (
    <div className={`break-words [&_pre_code]:bg-transparent [&_pre_code]:p-0 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
