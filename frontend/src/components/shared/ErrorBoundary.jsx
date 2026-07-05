import { Component } from 'react';
import Button from '@mui/material/Button';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          id="error-boundary-fallback"
          className="animate-fade-in flex flex-col items-center justify-center py-20 px-6 text-center"
        >
          <div
            className="mb-5 flex items-center justify-center rounded-full"
            style={{
              width: 72,
              height: 72,
              backgroundColor: 'var(--status-down-bg)',
            }}
          >
            <ErrorOutlineRoundedIcon
              sx={{ fontSize: 36, color: 'var(--status-down)', opacity: 0.8 }}
            />
          </div>

          <h3
            className="text-lg font-semibold mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            Something went wrong
          </h3>

          <p
            className="text-sm max-w-sm mb-6 leading-relaxed"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {this.state.error?.message || 'An unexpected error occurred while rendering this section.'}
          </p>

          <Button
            id="error-boundary-retry"
            onClick={this.handleReset}
            variant="contained"
            startIcon={<RefreshRoundedIcon />}
            sx={{
              bgcolor: 'var(--primary)',
              '&:hover': { bgcolor: 'var(--primary-hover)' },
              fontWeight: 600,
            }}
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
