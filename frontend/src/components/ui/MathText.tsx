"use client";

import React, { useEffect, useState } from "react";

declare global {
  interface Window {
    katex?: {
      renderToString: (
        tex: string,
        options?: { displayMode?: boolean; throwOnError?: boolean }
      ) => string;
    };
  }
}

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Standardize and clean LaTeX math string before sending to KaTeX
 */
function sanitizeLatex(math: string): string {
  if (!math) return "";
  return math
    // 1. Standardize degree notation: ^circ, ^{circ}, ^\circ -> ^{\circ}
    .replace(/\^\{?\\?circ\}?/gi, "^{\\circ}")
    // 2. Add space after degree if followed by a number: ^{\circ}30' -> ^{\circ} 30'
    .replace(/(\^\{\\circ\})(\d+)/g, "$1 $2")
    // 3. Handle raw unicode degree in math mode: 15° -> 15^{\circ}
    .replace(/°/g, "^{\\circ}");
}

/**
 * Clean fallback renderer if KaTeX is not yet loaded
 */
function cleanLatexFallback(math: string): string {
  return math
    .replace(/\\circ/g, "°")
    .replace(/\^\{?\\?circ\}?/gi, "°")
    .replace(/°/g, "°")
    .replace(/\\times/g, "×")
    .replace(/\\pm/g, "±")
    .replace(/\\div/g, "÷")
    .replace(/\\le(q)?/g, "≤")
    .replace(/\\ge(q)?/g, "≥")
    .replace(/\\ne(q)?/g, "≠")
    .replace(/\\approx/g, "≈")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β")
    .replace(/\\theta/g, "θ")
    .replace(/\\pi/g, "π")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)")
    .replace(/[\{\}]/g, "")
    .trim();
}

export function MathText({ text, className = "" }: MathTextProps) {
  const [katexLoaded, setKatexLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.katex) {
      setKatexLoaded(true);
      return;
    }
    const interval = setInterval(() => {
      if (typeof window !== "undefined" && window.katex) {
        setKatexLoaded(true);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  if (!text) return null;

  // Auto-wrap naked degree/angle expressions (e.g. 15^circ or 13^circ20') that missed $ delimiters
  const preparedText = text.replace(
    /(^|\s)([\d\.\+\-\*\/]+\s*\^\{?\\?circ\}?(?:\s*\d+['"]?)?)(?=\s|$|[,\.?!])/gi,
    (match, prefix, expr) => `${prefix}$${expr}$`
  );

  // Split by LaTeX delimiters ($$ ... $$ for block, $ ... $ for inline)
  const tokens = preparedText.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g);

  return (
    <span className={className}>
      {tokens.map((token, i) => {
        if (!token) return null;

        const isBlock = token.startsWith("$$") && token.endsWith("$$");
        const isInline = !isBlock && token.startsWith("$") && token.endsWith("$");

        if (isBlock || isInline) {
          const rawMath = isBlock ? token.slice(2, -2).trim() : token.slice(1, -1).trim();
          const cleanMath = sanitizeLatex(rawMath);

          if (katexLoaded && typeof window !== "undefined" && window.katex) {
            try {
              const html = window.katex.renderToString(cleanMath, {
                displayMode: isBlock,
                throwOnError: false,
              });
              return (
                <span
                  key={i}
                  className={isBlock ? "my-2 block overflow-x-auto text-center" : "inline-block px-0.5"}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            } catch {
              // Fallback on KaTeX parse error
            }
          }

          // Graceful fallback while KaTeX script loads
          return (
            <span
              key={i}
              className={isBlock ? "my-2 block text-center font-mono font-medium" : "inline-block px-0.5 font-mono font-medium"}
            >
              {cleanLatexFallback(cleanMath)}
            </span>
          );
        }

        return <React.Fragment key={i}>{token}</React.Fragment>;
      })}
    </span>
  );
}
