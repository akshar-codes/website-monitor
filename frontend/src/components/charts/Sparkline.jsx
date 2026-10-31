import { useTranslation } from "../../i18n";

export default function Sparkline({
  values = [],
  color = "#08a879",
  label = "Trend",
}) {
  const t = useTranslation();
  if (values.length < 2) return null;
  const width = 100;
  const height = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 4 - ((value - min) / span) * (height - 8);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      className="sparkline-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={t(label)}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
