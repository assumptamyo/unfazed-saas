import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { toEditorHtml } from "./richTextUtils";

const ToolButton = ({ onClick, active, label, children }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()} // keep the text selection
    onClick={onClick}
    title={label}
    aria-label={label}
    aria-pressed={active}
    className={`min-w-8 h-8 px-2 rounded-lg text-sm transition ${
      active ? "bg-[#211A16] text-white" : "text-[#6B5B52] hover:bg-[#F3EBDF] hover:text-[#2B221E]"
    }`}
  >
    {children}
  </button>
);

const Divider = () => <span className="w-px h-5 bg-[#EFE6DA] mx-1" />;

// TipTap editor. `value` is HTML, `onChange` receives HTML ("" when empty).
// The server sanitizes what's saved, so only plain formatting is ever stored.
const RichTextEditor = ({ value, onChange, placeholder = "Start writing…", minHeight = 220, compact = false }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: toEditorHtml(value),
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? "" : ed.getHTML()),
    editorProps: {
      attributes: {
        class: "rich-content focus:outline-none px-4 py-3",
        style: `min-height:${minHeight}px`,
      },
    },
  });

  if (!editor) return <div className="skeleton rounded-2xl" style={{ height: minHeight + 44 }} />;

  const can = editor.can();
  const setLink = () => {
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("Link address", previous);
    if (url === null) return;
    if (url === "") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="rounded-2xl border border-[#EFE6DA] bg-white focus-within:ring-2 focus-within:ring-[#FF9E4C]/40 focus-within:border-[#FF9E4C] transition">
      <div className={`flex flex-wrap items-center gap-0.5 border-b border-[#F3EBDF] ${compact ? "px-1.5 py-1" : "px-2 py-1.5"}`}>
        <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </ToolButton>
        <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em className="font-serif">I</em>
        </ToolButton>
        <ToolButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline">U</span>
        </ToolButton>
        <Divider />
        {!compact && (
          <>
            <ToolButton label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              H
            </ToolButton>
            <ToolButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              ❝
            </ToolButton>
          </>
        )}
        <ToolButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          •≡
        </ToolButton>
        <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1.
        </ToolButton>
        {!compact && (
          <ToolButton label="Link" active={editor.isActive("link")} onClick={setLink}>
            🔗
          </ToolButton>
        )}
        <span className="flex-1" />
        <ToolButton label="Undo" active={false} onClick={() => can.undo() && editor.chain().focus().undo().run()}>
          ↶
        </ToolButton>
        <ToolButton label="Redo" active={false} onClick={() => can.redo() && editor.chain().focus().redo().run()}>
          ↷
        </ToolButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

// Read-only rendering of saved rich text (already sanitized by the server)
export const RichTextView = ({ html, className = "" }) => (
  <div className={`rich-content ${className}`} dangerouslySetInnerHTML={{ __html: toEditorHtml(html) }} />
);

export default RichTextEditor;
