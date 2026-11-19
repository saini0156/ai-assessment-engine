
"use client";

import React, { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    katex?: {
      renderToString: (
        tex: string,
        options?: {
          displayMode?: boolean;
          throwOnError?: boolean;
          strict?: boolean | "ignore" | "warn" | "error";
        }
      ) => string;
    };
  }
}

const KATEX_CSS =
  "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";

const KATEX_JS =
  "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";

let katexPromise: Promise<void> | null = null;

/* Load KaTeX once */
function loadKatex(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Browser environment required"));
  }

  if (window.katex) return Promise.resolve();

  if (katexPromise) return katexPromise;

  katexPromise = new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      'script[data-katex="true"]'
    );

    let link = document.querySelector<HTMLLinkElement>(
      'link[data-katex="true"]'
    );

    let scriptDone = !!window.katex;
    let cssDone = !!link?.sheet;

    const checkComplete = () => {
      if (scriptDone && cssDone) resolve();
    };

    const handleScriptLoad = () => {
      scriptDone = true;
      checkComplete();
    };

    const handleCSSLoad = () => {
      cssDone = true;
      checkComplete();
    };

    if (!cssDone) {
      if (!link) {
        link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = KATEX_CSS;
        link.crossOrigin = "anonymous";
        link.dataset.katex = "true";
      }

      link.addEventListener("load", handleCSSLoad, { once: true });
      link.addEventListener(
        "error",
        () => reject(new Error("KaTeX CSS failed to load")),
        { once: true }
      );

      if (!link.isConnected) {
        document.head.appendChild(link);
      }
    }

    if (!scriptDone) {
      if (!script) {
        script = document.createElement("script");
        script.src = KATEX_JS;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.dataset.katex = "true";
      }

      script.addEventListener("load", handleScriptLoad, {
        once: true,
      });

      script.addEventListener(
        "error",
        () => reject(new Error("KaTeX JavaScript failed to load")),
        { once: true }
      );

      if (!script.isConnected) {
        document.head.appendChild(script);
      }
    }

    checkComplete();
  }).catch((error) => {
    katexPromise = null;
    throw error;
  });

  return katexPromise;
}

/* Standardize degree notation */
function sanitizeLatex(math: string): string {
  return math
    .replace(/\^\{?\\circ\}?/gi, "^{\\circ}")
    .replace(/°/g, "^{\\circ}");
}

/* Readable fallback if KaTeX is unavailable */
function cleanLatexFallback(math: string): string {
  return math
    .replace(/\^\{\\circ\}/g, "°")
    .replace(/\\circ\b/g, "°")
    .replace(/\\times\b/g, "×")
    .replace(/\\pm\b/g, "±")
    .replace(/\\div\b/g, "÷")
    .replace(/\\leq?\b/g, "≤")
    .replace(/\\geq?\b/g, "≥")
    .replace(/\\neq\b/g, "≠")
    .replace(/\\approx\b/g, "≈")
    .replace(/\\alpha\b/g, "α")
    .replace(/\\beta\b/g, "β")
    .replace(/\\theta\b/g, "θ")
    .replace(/\\pi\b/g, "π")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1 / $2)")
    .replace(/[{}]/g, "")
    .trim();
}

/* Convert naked degree expressions into inline math */
function prepareMathText(text: string): string {
  return text.replace(
    /(^|\s)(\d+(?:\.\d+)?\s*\^\\?circ(?:\s*\d+['"]?)?)(?=\s|$|[,.?!])/gi,
    (_match, prefix: string, expression: string) =>
      `${prefix}$${expression}$`
  );
}

/* Detect inline and block mathematical expressions */
const MATH_SPLIT =
  /(\$\$[\s\S]+?\$\$|\$(?!\s)[^$\n]+?\$(?!\d))/g;

const NEEDS_MATH =
  /\$\$[\s\S]+?\$\$|\$(?!\s)[^$\n]+?\$(?!\d)|\d+\s*\^\\?circ/i;

interface MathTextProps {
  text: string;
  className?: string;
}

export function MathText({
  text,
  className = "",
}: MathTextProps) {
  const [ready, setReady] = useState(false);

  /* Load KaTeX only when mathematical text exists */
  useEffect(() => {
    if (!text || !NEEDS_MATH.test(text)) {
      setReady(false);
      return;
    }

    let cancelled = false;

    loadKatex()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((error) => {
        console.error("KaTeX loading failed:", error);

        if (!cancelled) setReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [text]);

  const content = useMemo(() => {
    if (!text) return null;

    const prepared = prepareMathText(text);

    return prepared.split(MATH_SPLIT).map((token, index) => {
      if (!token) return null;

      const isBlock =
        token.startsWith("$$") && token.endsWith("$$");

      const isInline =
        !isBlock &&
        token.startsWith("$") &&
        token.endsWith("$");

      if (!isBlock && !isInline) {
        return (
          <React.Fragment key={index}>
            {token}
          </React.Fragment>
        );
      }

      const raw = isBlock
        ? token.slice(2, -2)
        : token.slice(1, -1);

      if (!raw.trim()) {
        return (
          <React.Fragment key={index}>
            {token}
          </React.Fragment>
        );
      }

      const math = sanitizeLatex(raw.trim());

      if (ready && window.katex) {
        try {
          const html = window.katex.renderToString(math, {
            displayMode: isBlock,
            throwOnError: false,
            strict: "ignore",
          });

          return (
            <span
              key={index}
              className={
                isBlock
                  ? "my-3 block max-w-full overflow-x-auto text-center"
                  : "inline-block px-0.5 align-middle"
              }
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (error) {
          console.error("KaTeX rendering failed:", error);
        }
      }

      return (
        <span
          key={index}
          className={
            isBlock
              ? "my-3 block max-w-full overflow-x-auto text-center font-mono"
              : "inline-block px-0.5 font-mono"
          }
        >
          {cleanLatexFallback(math)}
        </span>
      );
    });
  }, [text, ready]);

  if (!text) return null;

  return (
    <span className={`${className} whitespace-normal`}>
      {content}
    </span>
  );
}
