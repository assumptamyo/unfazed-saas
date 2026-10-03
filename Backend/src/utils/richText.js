import sanitizeHtml from "sanitize-html";

// Rich-text notes arrive as HTML from the editor. Only plain formatting is kept;
// scripts, styles, event handlers, images and anything else are removed, so a note
// can never run code in the browser of whoever reads it (including the client).
const OPTIONS = {
  allowedTags: ["p", "br", "strong", "em", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "a"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    b: "strong",
    i: "em",
  },
};

export const sanitizeRichText = (html) => sanitizeHtml(String(html || ""), OPTIONS);

// Plain text version for excerpts, search and word counts
export const richTextToPlain = (html) =>
  sanitizeHtml(String(html || "").replace(/<\/(p|h2|h3|li|blockquote|pre)>|<br\s*\/?>/gi, " "), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
