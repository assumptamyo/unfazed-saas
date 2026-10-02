const colorMap = {
  orange: { bg: "#FFF3E6", text: "#D96B00", ring: "#FFD4A3" },
  sage: { bg: "#EEF3F0", text: "#4F7161", ring: "#C7D9CE" },
  plum: { bg: "#F7EEF3", text: "#8A5C77", ring: "#E3C9D7" },
};

const StatCard = ({ label, value, icon, color = "orange" }) => {
  const c = colorMap[color];

  return (
    <div className="bg-white border border-[#EFE6DA] rounded-2xl p-5 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ backgroundColor: c.bg, color: c.text }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm text-[#6B6059]" style={{ fontFamily: "Inter, sans-serif" }}>
          {label}
        </p>
        <p className="text-3xl text-[#2B221E]" style={{ fontFamily: "Literata, serif", fontWeight: 560 }}>
          {value}
        </p>
      </div>
    </div>
  );
};

export default StatCard;    