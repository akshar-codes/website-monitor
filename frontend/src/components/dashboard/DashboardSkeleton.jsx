import { memo } from "react";
import Skeleton from "@mui/material/Skeleton";

const skeletonSx = {
  bgcolor: "var(--border)",
  borderRadius: "var(--radius-md)",
};

function PanelSkeleton({ height = 220 }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <Skeleton
        variant="text"
        width={140}
        height={20}
        sx={{ ...skeletonSx, mb: 2 }}
        animation="wave"
      />
      <Skeleton
        variant="rectangular"
        height={height}
        sx={{ ...skeletonSx, borderRadius: "var(--radius-lg)" }}
        animation="wave"
      />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderLeft: "4px solid var(--border)",
      }}
    >
      <Skeleton
        variant="text"
        width={100}
        height={14}
        sx={skeletonSx}
        animation="wave"
      />
      <Skeleton
        variant="text"
        width={70}
        height={36}
        sx={{ ...skeletonSx, mt: 1 }}
        animation="wave"
      />
      <Skeleton
        variant="text"
        width={120}
        height={12}
        sx={{ ...skeletonSx, mt: 1 }}
        animation="wave"
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div id="dashboard-loading" className="space-y-6 animate-fade-in pb-4">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton
            variant="text"
            width={160}
            height={30}
            sx={skeletonSx}
            animation="wave"
          />
          <Skeleton
            variant="text"
            width={240}
            height={16}
            sx={{ ...skeletonSx, mt: 0.5 }}
            animation="wave"
          />
        </div>
        <Skeleton
          variant="rounded"
          width={140}
          height={38}
          sx={skeletonSx}
          animation="wave"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <PanelSkeleton height={180} />
          <PanelSkeleton height={220} />
        </div>
        <div className="space-y-5">
          <PanelSkeleton height={200} />
          <PanelSkeleton height={160} />
          <PanelSkeleton height={140} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PanelSkeleton height={260} />
        <PanelSkeleton height={260} />
      </div>
    </div>
  );
}

export default memo(DashboardSkeleton);
