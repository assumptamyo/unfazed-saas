import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";

const BookingsChart = ({ data }) => {
  const formatted = data.map((d) => ({ ...d, label: format(parseISO(d.date), "MMM d") }));

  return (
    <div id="analytics" className="bg-white border border-[#EFE6DA] rounded-2xl p-6 scroll-mt-6">
      <h3 className="text-[#2B221E] text-lg mb-4" style={{ fontFamily: "Literata, serif" }}>
        Booking activity
        <span className="text-[#A89C8F] text-sm font-normal ml-2" style={{ fontFamily: "Inter, sans-serif" }}>
          last 14 days
        </span>
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={formatted}>
          <defs>
            <linearGradient id="bookingsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF9E4C" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#FF9E4C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3EBDF" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#A89C8F" }} axisLine={{ stroke: "#EFE6DA" }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#A89C8F" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid #EFE6DA", borderRadius: "10px", fontSize: "13px", fontFamily: "Inter, sans-serif" }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#D96B00"
            strokeWidth={2.5}
            fill="url(#bookingsGradient)"
            dot={{ fill: "#FF9E4C", r: 3.5, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BookingsChart;