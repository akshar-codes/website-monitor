import { memo, useMemo } from 'react';
import Skeleton from '@mui/material/Skeleton';

const skeletonSx = {
  bgcolor: 'var(--border)',
  borderRadius: 'var(--radius-md)',
  '&::after': {
    background:
      'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
  },
};

function CardSkeleton() {
  return (
    <div
      className="p-5 rounded-xl"
      style={{
        backgroundColor: 'var(--surface-raised)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="text" width={120} height={20} sx={skeletonSx} animation="wave" />
        <Skeleton variant="circular" width={28} height={28} sx={skeletonSx} animation="wave" />
      </div>
      <Skeleton variant="text" width="75%" height={32} sx={skeletonSx} animation="wave" />
      <Skeleton variant="text" width="50%" height={16} sx={{ ...skeletonSx, mt: 1 }} animation="wave" />
      <div className="flex items-center gap-2 mt-4">
        <Skeleton variant="rounded" width={64} height={24} sx={skeletonSx} animation="wave" />
        <Skeleton variant="rounded" width={80} height={24} sx={skeletonSx} animation="wave" />
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <Skeleton variant="circular" width={10} height={10} sx={skeletonSx} animation="wave" />
      <Skeleton variant="text" width="25%" height={18} sx={skeletonSx} animation="wave" />
      <Skeleton variant="text" width="30%" height={18} sx={skeletonSx} animation="wave" />
      <Skeleton variant="text" width="15%" height={18} sx={skeletonSx} animation="wave" />
      <Skeleton variant="rounded" width={60} height={22} sx={skeletonSx} animation="wave" />
      <div className="ml-auto">
        <Skeleton variant="text" width={80} height={18} sx={skeletonSx} animation="wave" />
      </div>
    </div>
  );
}

function TextSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton variant="text" width="90%" height={18} sx={skeletonSx} animation="wave" />
      <Skeleton variant="text" width="70%" height={18} sx={skeletonSx} animation="wave" />
      <Skeleton variant="text" width="80%" height={18} sx={skeletonSx} animation="wave" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="p-5 rounded-xl"
      style={{
        backgroundColor: 'var(--surface-raised)',
        border: '1px solid var(--border)',
      }}
    >
      <Skeleton variant="text" width={160} height={22} sx={{ ...skeletonSx, mb: 2 }} animation="wave" />
      <Skeleton
        variant="rectangular"
        width="100%"
        height={240}
        sx={{ ...skeletonSx, borderRadius: 'var(--radius-lg)' }}
        animation="wave"
      />
    </div>
  );
}

function LoadingSkeleton({ variant = 'card', count = 1 }) {
  const items = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  if (variant === 'chart') {
    return (
      <div id="loading-skeleton-chart" className="animate-fade-in">
        {items.map((i) => (
          <ChartSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div
        id="loading-skeleton-table"
        className="animate-fade-in rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--surface-raised)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Table header skeleton */}
        <div
          className="flex items-center gap-4 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <Skeleton variant="text" width="25%" height={14} sx={skeletonSx} animation="wave" />
          <Skeleton variant="text" width="30%" height={14} sx={skeletonSx} animation="wave" />
          <Skeleton variant="text" width="15%" height={14} sx={skeletonSx} animation="wave" />
          <Skeleton variant="text" width="10%" height={14} sx={skeletonSx} animation="wave" />
          <div className="ml-auto">
            <Skeleton variant="text" width={60} height={14} sx={skeletonSx} animation="wave" />
          </div>
        </div>
        {items.map((i) => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div id="loading-skeleton-text" className="animate-fade-in space-y-4">
        {items.map((i) => (
          <TextSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Default: card variant
  return (
    <div
      id="loading-skeleton-cards"
      className="animate-fade-in grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {items.map((i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export default memo(LoadingSkeleton);
