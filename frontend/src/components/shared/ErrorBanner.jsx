import { memo, useMemo } from 'react';
import Button from '@mui/material/Button';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

function ErrorBanner({ error, onRetry }) {
  const message = useMemo(() => {
    if (!error) return 'An unexpected error occurred.';
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    return 'An unexpected error occurred.';
  }, [error]);

  return (
    <div
      id="error-banner"
      className="animate-fade-in flex items-start gap-3 rounded-xl px-5 py-4"
      role="alert"
      style={{
        backgroundColor: 'var(--status-down-bg)',
        border: '1px solid var(--status-down)',
        borderLeftWidth: 4,
      }}
    >
      <ErrorOutlineRoundedIcon
        sx={{
          color: 'var(--status-down)',
          fontSize: 22,
          mt: '1px',
          flexShrink: 0,
        }}
      />

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold mb-0.5"
          style={{ color: 'var(--status-down)' }}
        >
          Something went wrong
        </p>
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {message}
        </p>
      </div>

      {onRetry && (
        <Button
          id="error-banner-retry"
          onClick={onRetry}
          size="small"
          variant="outlined"
          startIcon={<RefreshRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{
            flexShrink: 0,
            color: 'var(--status-down)',
            borderColor: 'var(--status-down)',
            fontWeight: 600,
            fontSize: '0.8rem',
            '&:hover': {
              borderColor: 'var(--status-down)',
              bgcolor: 'rgba(239, 68, 68, 0.08)',
            },
          }}
        >
          Retry
        </Button>
      )}
    </div>
  );
}

export default memo(ErrorBanner);
