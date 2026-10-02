import { useRef } from "react";

// Six single-digit boxes. Supports typing, backspace, arrow keys and pasting a whole code.
// Calls onComplete(code) when all six digits are filled.
const CodeInput = ({ value, onChange, onComplete, disabled, autoFocus = true }) => {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  const setAt = (index, digit) => {
    const next = digits.slice();
    next[index] = digit;
    const code = next.join("").slice(0, 6);
    onChange(code);
    if (code.length === 6 && !next.includes("")) onComplete?.(code);
  };

  const handleChange = (index, e) => {
    const typed = e.target.value.replace(/\D/g, "");
    if (!typed) return;
    if (typed.length > 1) {
      // Pasted or autofilled several digits
      const code = (digits.slice(0, index).join("") + typed).slice(0, 6);
      onChange(code);
      refs.current[Math.min(code.length, 5)]?.focus();
      if (code.length === 6) onComplete?.(code);
      return;
    }
    setAt(index, typed);
    if (index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setAt(index, "");
      } else if (index > 0) {
        setAt(index - 1, "");
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5" role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={`w-11 h-14 sm:w-12 sm:h-14 text-center text-2xl font-serif rounded-2xl border bg-white text-[#2B221E] transition focus:outline-none focus:ring-2 focus:ring-[#FF9E4C]/50 focus:border-[#FF9E4C] disabled:opacity-50 ${
            d ? "border-[#FFB877]" : "border-[#EFE6DA]"
          }`}
        />
      ))}
    </div>
  );
};

export default CodeInput;
