"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: ({ children, ...rest }) => (
    <p className="mb-2.5 last:mb-0 leading-relaxed text-slate-800" {...rest}>
      {children}
    </p>
  ),
  ul: ({ children, ...rest }) => (
    <ul className="mb-2.5 list-disc space-y-1 pl-5 text-slate-800 last:mb-0" {...rest}>
      {children}
    </ul>
  ),
  ol: ({ children, ...rest }) => (
    <ol className="mb-2.5 list-decimal space-y-1 pl-5 text-slate-800 last:mb-0" {...rest}>
      {children}
    </ol>
  ),
  li: ({ children, ...rest }) => (
    <li className="leading-relaxed" {...rest}>
      {children}
    </li>
  ),
  h1: ({ children, ...rest }) => (
    <h1 className="mb-2 mt-1 text-lg font-semibold text-slate-900" {...rest}>
      {children}
    </h1>
  ),
  h2: ({ children, ...rest }) => (
    <h2 className="mb-2 mt-3 text-base font-semibold text-slate-900 first:mt-0" {...rest}>
      {children}
    </h2>
  ),
  h3: ({ children, ...rest }) => (
    <h3 className="mb-1.5 mt-2 text-[15px] font-semibold text-slate-800 first:mt-0" {...rest}>
      {children}
    </h3>
  ),
  a: ({ children, href, ...rest }) => (
    <a
      href={href}
      className="font-medium text-[#2563eb] underline decoration-[#2563eb]/35 underline-offset-2 hover:text-[#1d4ed8]"
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...rest }) => (
    <blockquote
      className="mb-2.5 border-l-2 border-slate-300 pl-3 text-slate-600 italic last:mb-0"
      {...rest}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...rest }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      /*
       * Fenced blocks render as <pre><code class="language-…">. Parent `pre` supplies bg; keep text light on dark.
       * Do not rely on bg here — the old [&_pre_code]:bg-transparent on the wrapper made text-slate-100 on slate-50 (invisible).
       */
      return (
        <code
          className={`block w-full whitespace-pre-wrap break-words bg-transparent p-0 font-mono text-[13px] leading-relaxed text-slate-100 ${className ?? ""}`}
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800"
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...rest }) => (
    <pre
      className="mb-3 max-w-full overflow-x-auto rounded-xl border border-slate-600/90 bg-slate-900 p-3 text-slate-100 shadow-inner last:mb-0"
      {...rest}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...rest }) => (
    <div className="mb-3 max-w-full overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-left text-[13px] text-slate-800" {...rest}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...rest }) => (
    <thead className="bg-slate-100" {...rest}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...rest }) => <tbody {...rest}>{children}</tbody>,
  tr: ({ children, ...rest }) => <tr className="border-b border-slate-200" {...rest}>{children}</tr>,
  th: ({ children, ...rest }) => (
    <th className="border border-slate-200 bg-slate-100 px-2 py-1.5 font-semibold text-slate-900" {...rest}>
      {children}
    </th>
  ),
  td: ({ children, ...rest }) => (
    <td className="border border-slate-200 px-2 py-1.5 text-slate-700" {...rest}>
      {children}
    </td>
  ),
};

type Props = {
  text: string;
  className?: string;
};

/** GFM markdown for assistant replies — tuned for light chat bubbles. */
export function ChatMarkdown({ text, className = "" }: Props) {
  return (
    <div className={`break-words text-slate-800 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
