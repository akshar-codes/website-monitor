import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Network,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Server,
} from "lucide-react";
import { Page, Button, Notice } from "../components/ui/Primitives";
import {
  useDependencyGraph,
  useExternalServices,
  useDependencyMutations,
} from "../hooks/useDependencies";
import * as monitorsApi from "../services/api/monitors";
import * as dependenciesApi from "../services/api/dependencies";
import DependencyGraphView from "../components/dependencies/DependencyGraphView";
import DependencyDetailPanel from "../components/dependencies/DependencyDetailPanel";
import DependencyFormModal from "../components/dependencies/DependencyFormModal";
import { toast } from "sonner";

export default function Dependencies() {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEdge, setEditingEdge] = useState(null);
  const [modalInitialDependentId, setModalInitialDependentId] = useState("");
  const [monitors, setMonitors] = useState([]);

  // Load graph data (polling every 30 seconds for live health freshness)
  const {
    data: graphData,
    loading: graphLoading,
    error: graphError,
    refetch: refetchGraph,
  } = useDependencyGraph();

  // Load external services
  const { data: externalServicesData, refetch: refetchExternalServices } =
    useExternalServices();

  const externalServices = useMemo(() => {
    return (
      externalServicesData?.data ||
      (Array.isArray(externalServicesData) ? externalServicesData : [])
    );
  }, [externalServicesData]);

  // Load monitors for dropdown selectors
  useEffect(() => {
    let active = true;
    monitorsApi
      .getMonitors({ limit: 100 })
      .then((res) => {
        if (!active) return;
        const list = res?.data || (Array.isArray(res) ? res : []);
        setMonitors(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Graph elements
  const nodes = useMemo(() => graphData?.nodes || [], [graphData]);
  const edges = useMemo(() => graphData?.edges || [], [graphData]);

  // Selected node object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => String(n.id) === String(selectedNodeId)) || null;
  }, [selectedNodeId, nodes]);

  // Handle mutations
  const handleMutationSuccess = useCallback(() => {
    refetchGraph();
  }, [refetchGraph]);

  const {
    createDependency,
    updateDependency,
    deleteDependency,
    submitting: mutating,
  } = useDependencyMutations(handleMutationSuccess);

  // Compute summary metrics
  const metrics = useMemo(() => {
    let healthy = 0;
    let degradedOrStale = 0;
    let unhealthy = 0;
    let activeOutages = 0;

    for (const node of nodes) {
      const state = node.health?.state || "unknown";
      if (state === "healthy") healthy++;
      else if (state === "degraded" || state === "stale") degradedOrStale++;
      else if (state === "unhealthy") unhealthy++;

      if ((node.health?.activeIncidentsCount || 0) > 0) {
        activeOutages++;
      }
    }

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      healthy,
      degradedOrStale,
      unhealthy,
      activeOutages,
    };
  }, [nodes, edges]);

  // Modal open helpers
  const handleOpenAddModal = (preselectedDependentId = "") => {
    setEditingEdge(null);
    setModalInitialDependentId(
      preselectedDependentId ||
        (selectedNode?.type === "monitor" ? selectedNode.id : ""),
    );
    setModalOpen(true);
  };

  const handleOpenEditModal = (edge) => {
    setEditingEdge(edge);
    setModalInitialDependentId(edge.from);
    setModalOpen(true);
  };

  const handleModalSubmit = async (payload) => {
    if (editingEdge) {
      await updateDependency(payload.id, {
        dependencyType: payload.dependencyType,
        description: payload.description,
        enabled: payload.enabled,
      });
    } else {
      await createDependency(payload);
    }
  };

  const handleToggleDependency = async (edgeId, newEnabledState) => {
    try {
      await updateDependency(edgeId, { enabled: newEnabledState });
    } catch {
      // toast is handled in hook
    }
  };

  const handleDeleteDependency = async (edgeId) => {
    try {
      await deleteDependency(edgeId);
    } catch {
      // toast is handled in hook
    }
  };

  const handleCreateExternalService = async (serviceData) => {
    try {
      const res = await dependenciesApi.createExternalService(serviceData);
      const created = res?.data || res;
      toast.success(`Registered external service "${serviceData.name}"`);
      await refetchExternalServices();
      await refetchGraph();
      return created;
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create external service";
      toast.error(msg);
      throw err;
    }
  };

  return (
    <Page
      title="Service Dependency Map"
      description="Define system topology, map direct and upstream dependencies, and identify potential cascading failure paths."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => refetchGraph()}
            disabled={graphLoading}
            title="Refresh dependency graph and health status"
          >
            <RefreshCw
              size={14}
              className={graphLoading ? "animate-spin" : ""}
            />
            <span>Refresh</span>
          </Button>
          <Button
            variant="primary"
            onClick={() => handleOpenAddModal()}
            title="Add a new service dependency"
          >
            <Plus size={14} />
            <span>Add Dependency</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Error notification if backend request failed */}
        {graphError && (
          <Notice tone="danger">
            Failed to load dependency graph:{" "}
            {graphError.response?.data?.message || graphError.message}
          </Notice>
        )}

        {/* Metrics Overview Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <Server size={18} />
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-slate-500 uppercase block truncate">
                Total Services
              </span>
              <strong className="text-lg font-bold text-slate-900 leading-tight">
                {metrics.totalNodes}
              </strong>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <Network size={18} />
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-slate-500 uppercase block truncate">
                Relationships
              </span>
              <strong className="text-lg font-bold text-slate-900 leading-tight">
                {metrics.totalEdges}
              </strong>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <CheckCircle2 size={18} />
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-slate-500 uppercase block truncate">
                Healthy
              </span>
              <strong className="text-lg font-bold text-emerald-600 leading-tight">
                {metrics.healthy}
              </strong>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
              <AlertTriangle size={18} />
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-slate-500 uppercase block truncate">
                Degraded / Stale
              </span>
              <strong className="text-lg font-bold text-amber-600 leading-tight">
                {metrics.degradedOrStale}
              </strong>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0">
              <XCircle size={18} />
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-slate-500 uppercase block truncate">
                Unhealthy
              </span>
              <strong className="text-lg font-bold text-rose-600 leading-tight">
                {metrics.unhealthy}
              </strong>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0">
              <ShieldAlert size={18} />
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-slate-500 uppercase block truncate">
                Active Outages
              </span>
              <strong className="text-lg font-bold text-rose-700 leading-tight">
                {metrics.activeOutages}
              </strong>
            </div>
          </div>
        </div>

        {/* Main Graph Canvas and Detail Side-Panel Workspace */}
        <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-180">
          {/* Visual SVG DAG Canvas */}
          <div className="flex-1 h-full min-w-0 flex flex-col">
            <DependencyGraphView
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onAddDependency={() => handleOpenAddModal(selectedNodeId || "")}
            />
          </div>

          {/* Collapsible / Slide-In Detail Panel */}
          {selectedNode && (
            <DependencyDetailPanel
              node={selectedNode}
              allNodes={nodes}
              allEdges={edges}
              onClose={() => setSelectedNodeId(null)}
              onSelectNode={setSelectedNodeId}
              onAddDependency={(depId) => handleOpenAddModal(depId)}
              onEditDependency={handleOpenEditModal}
              onDeleteDependency={handleDeleteDependency}
              onToggleDependency={handleToggleDependency}
              mutating={mutating}
            />
          )}
        </div>
      </div>

      {/* Relationship Creation & Editing Modal */}
      <DependencyFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingEdge(null);
        }}
        onSubmit={handleModalSubmit}
        initialDependentId={modalInitialDependentId}
        initialData={editingEdge}
        monitors={monitors}
        externalServices={externalServices}
        existingEdges={edges}
        onCreateExternalService={handleCreateExternalService}
      />
    </Page>
  );
}
