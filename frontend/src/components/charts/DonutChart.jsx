import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const PALETTE = ["#08a879", "#ed5d62", "#e6a83e", "#8b9bb0", "#3b8edb"];

export default function DonutChart({
  data,
  dataKey = "value",
  nameKey = "name",
  colors = PALETTE,
  centerValue,
  centerLabel,
  height = 220,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          innerRadius={58}
          outerRadius={83}
          paddingAngle={3}
        >
          {data.map((item, index) => (
            <Cell
              key={item[nameKey] || index}
              fill={colors[index % colors.length]}
            />
          ))}
        </Pie>
        <Tooltip />
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="donut-center-value"
        >
          {centerValue ??
            data.reduce((sum, item) => sum + Number(item[dataKey] || 0), 0)}
        </text>
        {centerLabel && (
          <text
            x="50%"
            y="57%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="donut-center-label"
          >
            {centerLabel}
          </text>
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
