import { memo, useEffect, useRef, useState } from "react";

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function AnimatedNumber({
  value,
  duration = 700,
  decimals = 0,
  formatter,
  className = "",
  style,
}) {
  const target = Number.isFinite(value) ? value : 0;

  const [displayValue, setDisplayValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;

    if (from === target) {
      setDisplayValue(target);
      return undefined;
    }

    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = from + (target - from) * eased;

      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      fromRef.current = target;
    };
  }, [target, duration]);

  const rounded =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString();

  const output = formatter ? formatter(displayValue) : rounded;

  return (
    <span className={className} style={style}>
      {output}
    </span>
  );
}

export default memo(AnimatedNumber);
