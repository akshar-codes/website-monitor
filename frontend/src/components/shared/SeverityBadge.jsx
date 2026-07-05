import { memo } from 'react';
import Chip from '@mui/material/Chip';
import { SEVERITY_COLORS } from '../../utils/constants';

const SIZE_MAP = {
  sm: { height: 22, fontSize: '0.7rem', dotSize: 6, gap: 4, px: 8 },
  md: { height: 28, fontSize: '0.8rem', dotSize: 8, gap: 6, px: 10 },
};

function SeverityBadge({ severity, size = 'md' }) {
  const config = SEVERITY_COLORS[severity] || SEVERITY_COLORS.minor;
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <Chip
      id={`severity-badge-${severity}`}
      label={
        <span className="flex items-center" style={{ gap: sizeConfig.gap }}>
          <span
            style={{
              width: sizeConfig.dotSize,
              height: sizeConfig.dotSize,
              borderRadius: 'var(--radius-full)',
              backgroundColor: config.color,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          {config.label}
        </span>
      }
      size="small"
      sx={{
        height: sizeConfig.height,
        fontSize: sizeConfig.fontSize,
        fontWeight: 600,
        letterSpacing: '0.01em',
        backgroundColor: config.bg,
        color: config.color,
        borderRadius: 'var(--radius-full)',
        border: 'none',
        px: `${sizeConfig.px}px`,
        '& .MuiChip-label': {
          px: 0.5,
          py: 0,
        },
      }}
    />
  );
}

export default memo(SeverityBadge);
