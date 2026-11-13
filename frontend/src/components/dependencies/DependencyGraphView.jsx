import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Search,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  computeGraphLayout,
  getHealthProps,
  formatDirectionDescription,
} from "../../utils/dependencyFormat";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 86;

export default function DependencyGraphView({
  nodes = [],
  edges = [],
  selectedNodeId = null,
  onSelectNode,
  onAddDependency,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [healthFilter, setHealthFilter] = useState("all");
  const [activeOnly] = useState(false);

  // Pan & Zoom state
  const [transform, setTransform] = useState({ x: 40, y: 40, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const svgContainerRef = useRef(null);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const state = node.health?.state || node.healthState || "unknown";
      const hasIncident =
        (node.health?.activeIncidentsCount || 0) > 0 ||
        Boolean(node.activeIncident);

      if (
        searchTerm &&
        !node.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(node.url && node.url.toLowerCase().includes(searchTerm.toLowerCase()))
      ) {
        return false;
      }

      if (healthFilter === "healthy" && state !== "healthy") return false;
      if (healthFilter === "unhealthy" && state !== "unhealthy") return false;
      if (healthFilter === "degraded" && state !== "degraded") return false;
      if (healthFilter === "stale" && state !== "stale") return false;
      if (healthFilter === "incident" && !hasIncident) return false;
      return true;
    });
  }, [nodes, searchTerm, healthFilter]);

  const visibleNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => String(n.id))),
    [filteredNodes],
  );

  const filteredEdges = useMemo(() => {
    return edges.filter((e) => {
      const src = String(e.from || e.source);
      const tgt = String(e.to || e.target);
      if (activeOnly && e.enabled === false && !e.isActive) return false;
      return visibleNodeIds.has(src) && visibleNodeIds.has(tgt);
    });
  }, [edges, visibleNodeIds, activeOnly]);

  // Compute Layout
  const { positions, totalWidth, totalHeight } = useMemo(() => {
    return computeGraphLayout(filteredNodes, filteredEdges, {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      columnGap: 140,
      rowGap: 36,
      padding: 60,
    });
  }, [filteredNodes, filteredEdges]);

  // Determine upstream & downstream for selected node
  const { upstreamIds, downstreamIds, connectedEdgeIds } = useMemo(() => {
    if (!selectedNodeId) {
      return {
        upstreamIds: new Set(),
        downstreamIds: new Set(),
        connectedEdgeIds: new Set(),
      };
    }

    const up = new Set();
    const down = new Set();
    const connEdges = new Set();
    const sel = String(selectedNodeId);

    edges.forEach((edge) => {
      const src = String(edge.from || edge.source);
      const tgt = String(edge.to || edge.target);

      if (src === sel) {
        // Source depends on target -> target is upstream
        up.add(tgt);
        connEdges.add(edge.id);
      }
      if (tgt === sel) {
        // Target is depended on by source -> source is downstream
        down.add(src);
        connEdges.add(edge.id);
      }
    });

    return {
      upstreamIds: up,
      downstreamIds: down,
      connectedEdgeIds: connEdges,
    };
  }, [selectedNodeId, edges]);

  // Zoom handlers
  const handleZoom = useCallback((factor) => {
    setTransform((prev) => {
      const newScale = Math.min(Math.max(prev.scale + factor, 0.3), 2.5);
      return { ...prev, scale: Number(newScale.toFixed(2)) };
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setTransform({ x: 40, y: 40, scale: 1 });
  }, []);

  const handleFitToView = useCallback(() => {
    if (!svgContainerRef.current) return;
    const { clientWidth, clientHeight } = svgContainerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const scaleX = (clientWidth - 80) / totalWidth;
    const scaleY = (clientHeight - 80) / totalHeight;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 1.2);

    const newX = Math.max(20, (clientWidth - totalWidth * newScale) / 2);
    const newY = Math.max(20, (clientHeight - totalHeight * newScale) / 2);

    setTransform({
      x: Math.round(newX),
      y: Math.round(newY),
      scale: Number(newScale.toFixed(2)),
    });
  }, [totalWidth, totalHeight]);

  // Mouse pan handlers
  const handleMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      setIsPanning(true);
      dragStartRef.current = {
        x: e.clientX - transform.x,
        y: e.clientY - transform.y,
      };
    },
    [transform],
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isPanning) return;
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      }));
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.08 : -0.08;
    setTransform((prev) => {
      const newScale = Math.min(Math.max(prev.scale + zoomFactor, 0.3), 2.5);
      return { ...prev, scale: Number(newScale.toFixed(2)) };
    });
  }, []);

  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  return (
    <div className="relative w-full h-170 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col select-none text-slate-100">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/80 backdrop-blur border-b border-slate-800 z-10 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              aria-label="Search services"
            />
          </div>
          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            aria-label="Filter by health state"
          >
            <option value="all">All Health States</option>
            <option value="healthy">Healthy Only</option>
            <option value="unhealthy">Unhealthy / Outages</option>
            <option value="degraded">Degraded</option>
            <option value="stale">Stale Data</option>
            <option value="incident">Active Incidents Only</option>
          </select>
        </div>

        {/* Direction explanation & Legend */}
        <div className="hidden lg:flex items-center gap-4 text-[11px] text-slate-400 border-x border-slate-800 px-4">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-200">Direction:</span>
            <span className="text-indigo-300">A</span>
            <span className="text-slate-500">&rarr;</span>
            <span className="text-emerald-300">B</span>
            <span className="text-slate-500">(A depends on B)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 bg-indigo-400"></span>
            <span>Hard / Soft</span>
            <span className="inline-block w-4 h-0.5 border-t border-dashed border-slate-400"></span>
          </div>
        </div>

        {/* Navigation & Zoom controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleZoom(0.15)}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleFitToView}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Fit to View"
            aria-label="Fit to View"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Reset Zoom & Pan"
            aria-label="Reset Zoom & Pan"
          >
            <RotateCcw size={14} />
          </button>
          <span className="text-[10px] text-slate-500 font-mono ml-1">
            {Math.round(transform.scale * 100)}%
          </span>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        ref={svgContainerRef}
        className={`w-full flex-1 overflow-hidden relative ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width="100%"
          height="100%"
          className="w-full h-full"
          onClick={() => onSelectNode?.(null)}
        >
          <defs>
            {/* Background Grid Pattern */}
            <pattern
              id="graph-grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1" fill="#1e293b" />
            </pattern>

            {/* Standard Directed Markers: A -> B means A depends on B */}
            <marker
              id="arrow-marker"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6366f1" />
            </marker>

            <marker
              id="arrow-marker-selected"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
            </marker>

            <marker
              id="arrow-hard"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6366f1" />
            </marker>

            <marker
              id="arrow-soft"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
            </marker>

            <marker
              id="arrow-highlight"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Grid Background */}
          <rect width="100%" height="100%" fill="url(#graph-grid)" />

          {/* Transform Container */}
          <g
            transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
          >
            {/* 1. Directed Edges */}
            {filteredEdges.map((edge) => {
              const srcId = String(edge.from || edge.source);
              const tgtId = String(edge.to || edge.target);
              const srcPos = positions.get(srcId);
              const tgtPos = positions.get(tgtId);
              if (!srcPos || !tgtPos) return null;

              // Connect from right edge of source (consumer) to left edge of target (provider)
              const startX = srcPos.x + NODE_WIDTH;
              const startY = srcPos.y + NODE_HEIGHT / 2;
              const endX = tgtPos.x;
              const endY = tgtPos.y + NODE_HEIGHT / 2;

              // Smooth cubic bezier curve
              const dx = Math.abs(endX - startX) * 0.5;
              const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

              const isHighlighted =
                connectedEdgeIds.has(edge.id) ||
                srcId === String(selectedNodeId) ||
                tgtId === String(selectedNodeId);
              const isDimmed = selectedNodeId && !isHighlighted;
              const isHard = edge.dependencyType === "hard";

              const strokeColor = isHighlighted
                ? "#38bdf8"
                : isHard
                  ? "#6366f1"
                  : "#94a3b8";

              const markerId = isHighlighted
                ? "url(#arrow-marker-selected)"
                : "url(#arrow-marker)";

              return (
                <g
                  key={edge.id}
                  className={`transition-opacity duration-200 ${
                    isDimmed ? "opacity-20" : "opacity-100"
                  }`}
                >
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? 2.5 : isHard ? 1.8 : 1.4}
                    strokeDasharray={isHard ? "none" : "5,4"}
                    markerEnd={markerId}
                  />
                  {/* Invisible thicker path for tooltip hover */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    className="cursor-pointer"
                  >
                    <title>
                      {formatDirectionDescription(
                        srcId,
                        tgtId,
                        edge.dependencyType,
                      )}
                    </title>
                  </path>
                </g>
              );
            })}

            {/* 2. Nodes */}
            {filteredNodes.map((node) => {
              const sId = String(node.id);
              const pos = positions.get(sId);
              if (!pos) return null;

              const isSelected = String(selectedNodeId) === sId;
              const isUpstream = upstreamIds.has(sId);
              const isDownstream = downstreamIds.has(sId);
              const isDimmed =
                selectedNodeId && !isSelected && !isUpstream && !isDownstream;

              const healthState =
                node.health?.state || node.healthState || "unknown";
              const health = getHealthProps(healthState);
              const hasIncident =
                (node.health?.activeIncidentsCount || 0) > 0 ||
                Boolean(node.activeIncident);
              const _isStale = healthState === "stale" || Boolean(node.isStale);
              const respTime = node.health?.responseTime ?? node.responseTime;

              // Ring & glow styles for selection
              let borderStroke = isSelected
                ? "#38bdf8"
                : isUpstream
                  ? "#60a5fa"
                  : isDownstream
                    ? "#c084fc"
                    : "#334155";
              let strokeWidth = isSelected
                ? 2.5
                : isUpstream || isDownstream
                  ? 2
                  : 1;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectNode?.(node.id || node);
                  }}
                  className={`cursor-pointer transition-all duration-200 ${
                    isDimmed ? "opacity-30" : "opacity-100"
                  }`}
                  data-testid={`dependency-node-${node.id}`}
                >
                  {/* Selection Glow Filter */}
                  {isSelected && (
                    <rect
                      x="-4"
                      y="-4"
                      width={NODE_WIDTH + 8}
                      height={NODE_HEIGHT + 8}
                      rx="12"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      opacity="0.4"
                    />
                  )}

                  {/* Card Background */}
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="8"
                    fill="#0f172a"
                    stroke={borderStroke}
                    strokeWidth={strokeWidth}
                    className="hover:stroke-indigo-400 transition-colors"
                  />

                  {/* Health Indicator Accent Stripe (left side) */}
                  <rect
                    x="0"
                    y="0"
                    width="4"
                    height={NODE_HEIGHT}
                    rx="2"
                    fill={
                      healthState === "healthy"
                        ? "#10b981"
                        : healthState === "unhealthy"
                          ? "#f43f5e"
                          : healthState === "degraded"
                            ? "#f59e0b"
                            : healthState === "stale"
                              ? "#eab308"
                              : "#64748b"
                    }
                  />

                  {/* Node Title & Type Icon */}
                  <text
                    x="14"
                    y="22"
                    fill="#f8fafc"
                    fontSize="12"
                    fontWeight="600"
                    className="font-sans"
                  >
                    {node.name.length > 22
                      ? `${node.name.slice(0, 20)}...`
                      : node.name}
                  </text>

                  {/* URL / Host subtitle */}
                  <text
                    x="14"
                    y="38"
                    fill="#94a3b8"
                    fontSize="9.5"
                    fontFamily="monospace"
                  >
                    {node.url
                      ? node.url.replace(/^https?:\/\//, "").slice(0, 26)
                      : node.kind || node.category || "service"}
                  </text>

                  {/* Health Badge & Freshness Pill */}
                  <g transform="translate(14, 52)">
                    {/* Status Pill */}
                    <rect
                      width="66"
                      height="18"
                      rx="4"
                      fill={
                        healthState === "healthy"
                          ? "#064e3b"
                          : healthState === "unhealthy"
                            ? "#881337"
                            : healthState === "degraded"
                              ? "#78350f"
                              : "#1e293b"
                      }
                      stroke={
                        healthState === "healthy"
                          ? "#059669"
                          : healthState === "unhealthy"
                            ? "#e11d48"
                            : "#475569"
                      }
                      strokeWidth="0.8"
                    />
                    <circle
                      cx="8"
                      cy="9"
                      r="3"
                      fill={
                        healthState === "healthy"
                          ? "#10b981"
                          : healthState === "unhealthy"
                            ? "#f43f5e"
                            : "#94a3b8"
                      }
                    />
                    <text
                      x="16"
                      y="12"
                      fill="#f1f5f9"
                      fontSize="9"
                      fontWeight="600"
                    >
                      {health.label}
                    </text>

                    {/* Latency or Incident indicator */}
                    {hasIncident ? (
                      <g transform="translate(74, 0)">
                        <rect
                          width="58"
                          height="18"
                          rx="4"
                          fill="#4c0519"
                          stroke="#e11d48"
                          strokeWidth="0.8"
                        />
                        <text
                          x="6"
                          y="12"
                          fill="#fecdd3"
                          fontSize="8.5"
                          fontWeight="700"
                        >
                          OUTAGE
                        </text>
                      </g>
                    ) : respTime != null ? (
                      <g transform="translate(74, 0)">
                        <rect
                          width="52"
                          height="18"
                          rx="4"
                          fill="#1e293b"
                          stroke="#334155"
                          strokeWidth="0.8"
                        />
                        <text
                          x="6"
                          y="12"
                          fill="#cbd5e1"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          {Math.round(respTime)}ms
                        </text>
                      </g>
                    ) : null}
                  </g>

                  {/* Upstream / Downstream Tags for Selected Node Context */}
                  {isUpstream && (
                    <g transform={`translate(${NODE_WIDTH - 66}, 6)`}>
                      <rect
                        width="60"
                        height="15"
                        rx="3"
                        fill="#1e3a8a"
                        stroke="#3b82f6"
                        strokeWidth="0.7"
                      />
                      <text
                        x="5"
                        y="11"
                        fill="#93c5fd"
                        fontSize="8"
                        fontWeight="700"
                      >
                        UPSTREAM
                      </text>
                    </g>
                  )}

                  {isDownstream && (
                    <g transform={`translate(${NODE_WIDTH - 76}, 6)`}>
                      <rect
                        width="70"
                        height="15"
                        rx="3"
                        fill="#581c87"
                        stroke="#a855f7"
                        strokeWidth="0.7"
                      />
                      <text
                        x="5"
                        y="11"
                        fill="#d8b4fe"
                        fontSize="8"
                        fontWeight="700"
                      >
                        DOWNSTREAM
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Empty State Overlay */}
      {nodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6 text-center z-20">
          <Layers size={40} className="text-slate-500 mb-3" />
          <h3 className="text-base font-semibold text-slate-200">
            No services or dependencies mapped yet
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Map relationships between your monitored services to visualize
            architecture and track cascading failures.
          </p>
          {onAddDependency && (
            <button
              onClick={onAddDependency}
              data-testid="add-first-dependency"
              className="mt-4 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
            >
              <span>Add First Dependency</span>
            </button>
          )}
        </div>
      ) : filteredNodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6 text-center z-20">
          <Layers size={40} className="text-slate-500 mb-3" />
          <h3 className="text-base font-semibold text-slate-200">
            No services match the current filter
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Try adjusting your search query or reset the health filter to see
            monitored nodes.
          </p>
          <button
            onClick={() => {
              setSearchTerm("");
              setHealthFilter("all");
            }}
            className="mt-4 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : null}

      {/* No Relationships Banner */}
      {filteredNodes.length > 0 && edges.length === 0 && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 bg-slate-950/95 border border-indigo-500/30 rounded-lg p-3 shadow-xl max-w-md z-10 flex items-start gap-3">
          <div className="p-2 rounded bg-indigo-500/10 text-indigo-400 shrink-0">
            <Layers size={18} />
          </div>
          <div className="text-xs">
            <b className="text-slate-200 block mb-0.5">
              No dependency relationships yet
            </b>
            <p className="text-slate-400 text-[11px] mb-2">
              All monitored services are floating independently. Link services
              to track root causes and downstream blast radius.
            </p>
            {onAddDependency && (
              <button
                onClick={onAddDependency}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                Add first relationship <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
