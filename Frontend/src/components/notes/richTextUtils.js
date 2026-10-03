// Notes written before rich text existed are plain text: turn their lines into paragraphs
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const toEditorHtml = (value = "") =>
  /^\s*</.test(value)
    ? value
    : value
        .split(/\n{2,}/)
        .map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`)
        .join("");
