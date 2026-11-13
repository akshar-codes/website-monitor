export const HEALTH_STATE_PROPS = Object.freeze({
  healthy: {
    label: "Healthy",
    tone: "green",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
    ringClass: "ring-emerald-500/30",
    borderClass: "border-emerald-300",
    textClass: "text-emerald-700",
    bgClass: "bg-white",
  },
  unhealthy: {
    label: "Unhealthy",
    tone: "red",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500 animate-pulse",
    ringClass: "ring-rose-500/30",
    borderClass: "border-rose-400",
    textClass: "text-rose-700",
    bgClass: "bg-rose-50/20",
  },
  degraded: {
    label: "Degraded",
    tone: "amber",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
    ringClass: "ring-amber-500/30",
    borderClass: "border-amber-400",
    textClass: "text-amber-700",
    bgClass: "bg-amber-50/20",
  },
  stale: {
    label: "Stale Data",
    tone: "yellow",
    badgeClass: "bg-yellow-50 text-yellow-800 border-yellow-200",
    dotClass: "bg-yellow-500",
    ringClass: "ring-yellow-500/30",
    borderClass: "border-yellow-400 border-dashed",
    textClass: "text-amber-800",
    bgClass: "bg-yellow-50/20",
  },
  disabled: {
    label: "Disabled",
    tone: "gray",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    dotClass: "bg-slate-400",
    ringClass: "ring-slate-400/20",
    borderClass: "border-slate-300",
    textClass: "text-slate-600",
    bgClass: "bg-slate-50/50",
  },
  unknown: {
    label: "Unknown",
    tone: "blue",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-400",
    ringClass: "ring-blue-400/30",
    borderClass: "border-blue-300",
    textClass: "text-blue-700",
    bgClass: "bg-white",
  },
});

export const getHealthProps = (state) => {
  return HEALTH_STATE_PROPS[state] || HEALTH_STATE_PROPS.unknown;
};

/**
 * Formats data freshness into human-readable text.
 * Strictly avoids treating missing data as healthy.
 */
export const formatFreshness = (lastCheckedAt, _isStale) => {
  if (!lastCheckedAt) {
    return "No checks recorded";
  }
  const date = new Date(lastCheckedAt);
  if (isNaN(date.getTime())) {
    return "Invalid check timestamp";
  }

  const diffMs = Math.abs(Date.now() - date.getTime());
  if (diffMs < 5000) {
    return "Just now";
  }
  if (diffMs < 60000) {
    return `${Math.floor(diffMs / 1000)}s ago`;
  }
  if (diffMs < 3600000) {
    return `${Math.floor(diffMs / 60000)}m ago`;
  }
  if (diffMs < 86400000) {
    return `${Math.floor(diffMs / 3600000)}h ago`;
  }
  return `${Math.floor(diffMs / 86400000)}d ago`;
};

/**
 * Explicit directional description: A depends on B.
 */
export const formatDirectionDescription = (
  sourceName,
  targetName,
  type = "hard",
) => {
  if (!sourceName && !targetName) return "Source depends on Target";
  const typeText = type === "hard" ? "depends on" : "softly depends on";
  return `${sourceName || "Source"} ${typeText} ${targetName || "Target"}`;
};

/**
 * Computes deterministic layered topological coordinates for nodes in a DAG.
 * Spreads nodes across horizontal rank columns from left (consumers) to right (providers).
 *
 * @param {Array<Object>} nodes
 * @param {Array<Object>} edges
 * @param {Object} [options]
 */
export const computeGraphLayout = (
  nodes = [],
  edges = [],
  {
    nodeWidth = 240,
    nodeHeight = 90,
    columnGap = 160,
    rowGap = 40,
    padding = 60,
  } = {},
) => {
  const positions = new Map();
  if (!nodes || nodes.length === 0) {
    return {
      positions,
      totalWidth: 800,
      totalHeight: 600,
      layoutNodes: [],
      layoutEdges: [],
      bounds: { width: 800, height: 600 },
    };
  }

  // 1. Build adjacency (source -> target means source depends on target)
  const outgoing = new Map(); // dependents -> dependencies
  const incoming = new Map(); // dependencies -> dependents

  nodes.forEach((n) => {
    const id = String(n.id);
    outgoing.set(id, []);
    incoming.set(id, []);
  });

  edges.forEach((e) => {
    const src = String(e.from || e.source);
    const tgt = String(e.to || e.target);
    if (outgoing.has(src) && incoming.has(tgt)) {
      outgoing.get(src).push(tgt);
      incoming.get(tgt).push(src);
    }
  });

  // 2. Assign topological rank
  // Rank 0: nodes with no incoming dependencies from other nodes (pure upstream / roots),
  // OR topological level based on dependencies.
  // In A -> B (A depends on B), let's place A on Left (Column 0, Consumer) and B on Right (Column 1, Provider),
  // so directed arrows point cleanly Left-to-Right from dependent to dependency!
  const rank = new Map();

  const getRank = (nodeId, visited = new Set()) => {
    const sId = String(nodeId);
    if (visited.has(sId)) return 0;
    if (rank.has(sId)) return rank.get(sId);

    visited.add(sId);
    const callers = incoming.get(sId) || [];
    if (callers.length === 0) {
      rank.set(sId, 0);
      return 0;
    }

    let maxCallerRank = 0;
    for (const callerId of callers) {
      const r = getRank(callerId, new Set(visited));
      if (r + 1 > maxCallerRank) {
        maxCallerRank = r + 1;
      }
    }

    rank.set(sId, maxCallerRank);
    return maxCallerRank;
  };

  nodes.forEach((n) => getRank(n.id));

  // 3. Group nodes by rank
  const columns = new Map();
  nodes.forEach((n) => {
    const sId = String(n.id);
    const r = rank.get(sId) || 0;
    if (!columns.has(r)) columns.set(r, []);
    columns.get(r).push(n);
  });

  const sortedRanks = Array.from(columns.keys()).sort((a, b) => a - b);
  let maxColumnHeight = 0;

  sortedRanks.forEach((colRank) => {
    const colNodes = columns.get(colRank);
    const colHeight =
      colNodes.length * nodeHeight + (colNodes.length - 1) * rowGap;
    if (colHeight > maxColumnHeight) {
      maxColumnHeight = colHeight;
    }
  });

  // 4. Assign (x, y) coordinates with centered vertical alignment per column
  sortedRanks.forEach((colRank) => {
    const colNodes = columns.get(colRank);
    const colHeight =
      colNodes.length * nodeHeight + (colNodes.length - 1) * rowGap;
    const startY = padding + (maxColumnHeight - colHeight) / 2;

    colNodes.forEach((n, idx) => {
      const x = padding + colRank * (nodeWidth + columnGap);
      const y = startY + idx * (nodeHeight + rowGap);
      positions.set(String(n.id), { x, y });
    });
  });

  const totalWidth =
    padding * 2 +
    sortedRanks.length * nodeWidth +
    (sortedRanks.length - 1) * columnGap;
  const totalHeight = padding * 2 + maxColumnHeight;

  const layoutNodes = nodes.map((n) => {
    const pos = positions.get(String(n.id)) || { x: padding, y: padding };
    return { ...n, x: pos.x, y: pos.y };
  });

  const layoutEdges = edges.map((e) => {
    const sId = String(e.from || e.source);
    const tId = String(e.to || e.target);
    const srcPos = positions.get(sId) || { x: padding, y: padding };
    const tgtPos = positions.get(tId) || { x: padding + 200, y: padding };
    return {
      ...e,
      sourceX: srcPos.x + nodeWidth,
      sourceY: srcPos.y + nodeHeight / 2,
      targetX: tgtPos.x,
      targetY: tgtPos.y + nodeHeight / 2,
      path: `M ${srcPos.x + nodeWidth} ${srcPos.y + nodeHeight / 2} C ${srcPos.x + nodeWidth + 50} ${srcPos.y + nodeHeight / 2}, ${tgtPos.x - 50} ${tgtPos.y + nodeHeight / 2}, ${tgtPos.x} ${tgtPos.y + nodeHeight / 2}`,
    };
  });

  return {
    positions,
    totalWidth: Math.max(900, totalWidth),
    totalHeight: Math.max(600, totalHeight),
    layoutNodes,
    layoutEdges,
    bounds: {
      width: Math.max(900, totalWidth),
      height: Math.max(600, totalHeight),
    },
  };
};
