import { useState } from "react";

// Chips you can add by typing + Enter (or comma) or by tapping a suggestion.
const TagInput = ({ value, onChange, suggestions = [], placeholder, max = 15, maxLength = 50, tone = "orange" }) => {
  const [draft, setDraft] = useState("");
  const has = (tag) => value.some((v) => v.toLowerCase() === tag.toLowerCase());
  const full = value.length >= max;

  const add = (raw) => {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, maxLength);
    if (!tag || has(tag) || full) return;
    onChange([...value, tag]);
  };

  const remove = (tag) => onChange(value.filter((v) => v !== tag));

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
      setDraft("");
    } else if (e.key === "Backspace" && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const chip =
    tone === "sage"
      ? "bg-[#EEF3F0] border-[#D7E5DC] text-[#3F5C4F]"
      : "bg-[#FFF3E6] border-[#FFD9AE] text-[#8A4B00]";

  const unused = suggestions.filter((s) => !has(s));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 bg-[#FBF8F3] border border-[#EFE6DA] rounded-2xl p-2.5 focus-within:ring-2 focus-within:ring-[#FF9E4C]/40 focus-within:border-[#FF9E4C] transition">
        {value.map((tag) => (
          <span key={tag} className={`flex items-center gap-1.5 text-sm font-medium pl-3 pr-1.5 py-1 rounded-full border animate-pop ${chip}`}>
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={`Remove ${tag}`}
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-60 hover:opacity-100 hover:bg-white/70 transition"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(",", ""))}
          onKeyDown={onKeyDown}
          onBlur={() => {
            add(draft);
            setDraft("");
          }}
          disabled={full}
          maxLength={maxLength}
          placeholder={full ? `Maximum ${max} reached` : value.length ? "Add another…" : placeholder}
          className="flex-1 min-w-[140px] bg-transparent px-1.5 py-1 text-sm text-[#2B221E] placeholder-[#A89C8F] focus:outline-none"
        />
      </div>

      {unused.length > 0 && !full && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <span className="text-[11px] text-[#A89C8F] py-1 mr-0.5">Suggestions:</span>
          {unused.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="text-xs px-2.5 py-1 rounded-full border border-dashed border-[#E5DCD3] text-[#6B5B52] hover:border-[#FF9E4C] hover:text-[#D96B00] hover:bg-[#FFF8F0] transition"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagInput;
