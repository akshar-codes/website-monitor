import ApiError from "./ApiError.js";
import { GRAPH_LIMITS } from "../config/constants.js";

/**
 * Builds an adjacency list representation from an array of directed dependency edges.
 * Edge representation: (source, target) means source depends on target.
 *
 * @param {Array<{dependentId: string, dependencyId: string}>} edges
 * @param {{dependentId: string, dependencyId: string}|null} candidateEdge
 * @returns {Map<string, Set<string>>}
 */
export const buildAdjacencyList = (edges = [], candidateEdge = null) => {
  const adj = new Map();

  const addEdge = (u, v) => {
    if (!u || !v) return;
    const from = String(u);
    const to = String(v);
    if (!adj.has(from)) adj.set(from, new Set());
    if (!adj.has(to)) adj.set(to, new Set());
    adj.get(from).add(to);
  };

  for (const edge of edges) {
    const from = edge.dependentId || edge.dependentMonitor || edge.dependent;
    const to =
      edge.dependencyId ||
      edge.dependencyMonitor ||
      edge.dependencyExternalService ||
      edge.dependency;
    addEdge(from, to);
  }

  if (candidateEdge) {
    const from =
      candidateEdge.dependentId ||
      candidateEdge.dependentMonitor ||
      candidateEdge.dependent;
    const to =
      candidateEdge.dependencyId ||
      candidateEdge.dependencyMonitor ||
      candidateEdge.dependencyExternalService ||
      candidateEdge.dependency;
    addEdge(from, to);
  }

  return adj;
};

/**
 * Finds a directed path from startNode to targetNode using BFS.
 * Used to trace the exact circular path when adding an edge creates a cycle.
 *
 * @param {Map<string, Set<string>>} adj
 * @param {string} startNode
 * @param {string} targetNode
 * @returns {string[] | null} Array of node IDs forming the path, or null if no path.
 */
export const findPath = (adj, startNode, targetNode) => {
  if (startNode === targetNode) return [startNode];
  const queue = [[startNode]];
  const visited = new Set([startNode]);

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const currentNode = currentPath[currentPath.length - 1];

    const neighbors = adj.get(currentNode) || new Set();
    for (const neighbor of neighbors) {
      if (neighbor === targetNode) {
        return [...currentPath, targetNode];
      }
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...currentPath, neighbor]);
      }
    }
  }

  return null;
};

/**
 * Formats a cycle path into a human-readable string using monitor/service names if available.
 *
 * @param {string[]} cyclePath
 * @param {Map<string, string>} nodeNameMap
 * @returns {string}
 */
export const formatCyclePath = (cyclePath, nodeNameMap = new Map()) => {
  return cyclePath
    .map((id) => nodeNameMap.get(id) || `Monitor(${id.slice(-6)})`)
    .join(" → ");
};

/**
 * Detects cycles in a graph (or checks whether adding candidateEdge introduces a cycle).
 *
 * @param {Array<Object>} existingEdges
 * @param {Object|null} candidateEdge
 * @param {Map<string, string>} nodeNameMap
 * @returns {{hasCycle: boolean, cyclePath: string[] | null, formattedCycle: string | null}}
 */
export const detectCycle = (
  existingEdges = [],
  candidateEdge = null,
  nodeNameMap = new Map(),
) => {
  if (candidateEdge) {
    const from = String(
      candidateEdge.dependentId ||
        candidateEdge.dependentMonitor ||
        candidateEdge.dependent,
    );
    const to = String(
      candidateEdge.dependencyId ||
        candidateEdge.dependencyMonitor ||
        candidateEdge.dependencyExternalService ||
        candidateEdge.dependency,
    );

    // Self-dependency is an immediate cycle of length 1
    if (from === to) {
      const cyclePath = [from, to];
      return {
        hasCycle: true,
        cyclePath,
        formattedCycle: formatCyclePath(cyclePath, nodeNameMap),
      };
    }

    // Build adjacency list of existing edges
    const adj = buildAdjacencyList(existingEdges);

    // If a path from 'to' to 'from' already exists in the existing graph,
    // adding the edge 'from' -> 'to' will complete the cycle: from -> to -> ... -> from.
    const existingPath = findPath(adj, to, from);
    if (existingPath) {
      const cyclePath = [from, ...existingPath];
      return {
        hasCycle: true,
        cyclePath,
        formattedCycle: formatCyclePath(cyclePath, nodeNameMap),
      };
    }

    return { hasCycle: false, cyclePath: null, formattedCycle: null };
  }

  // Full graph cycle detection using 3-color DFS
  const adj = buildAdjacencyList(existingEdges);
  const color = new Map(); // 0 = WHITE (unvisited), 1 = GRAY (visiting), 2 = BLACK (visited)
  const parent = new Map();

  for (const node of adj.keys()) {
    color.set(node, 0);
  }

  let cycleFound = null;

  const dfs = (u) => {
    color.set(u, 1);
    const neighbors = adj.get(u) || new Set();

    for (const v of neighbors) {
      if (color.get(v) === 1) {
        // Back edge found (cycle)
        const path = [v, u];
        let curr = u;
        while (curr && parent.has(curr) && parent.get(curr) !== v) {
          curr = parent.get(curr);
          path.push(curr);
        }
        path.reverse();
        path.push(v);
        cycleFound = path;
        return true;
      }
      if (color.get(v) === 0) {
        parent.set(v, u);
        if (dfs(v)) return true;
      }
    }

    color.set(u, 2);
    return false;
  };

  for (const node of adj.keys()) {
    if (color.get(node) === 0) {
      if (dfs(node)) break;
    }
  }

  if (cycleFound) {
    return {
      hasCycle: true,
      cyclePath: cycleFound,
      formattedCycle: formatCyclePath(cycleFound, nodeNameMap),
    };
  }

  return { hasCycle: false, cyclePath: null, formattedCycle: null };
};

/**
 * Calculates the maximum dependency depth (longest path in hops) in the graph.
 * A single edge A -> B has depth 1.
 *
 * @param {Array<Object>} existingEdges
 * @param {Object|null} candidateEdge
 * @returns {number} Maximum path depth in hops
 */
export const calculateMaxDepth = (existingEdges = [], candidateEdge = null) => {
  const adj = buildAdjacencyList(existingEdges, candidateEdge);
  const memo = new Map();

  const getDepth = (u, visited = new Set()) => {
    if (visited.has(u)) return 0; // Prevent infinite loop if cycle exists
    if (memo.has(u)) return memo.get(u);

    visited.add(u);
    const neighbors = adj.get(u) || new Set();
    let maxChildDepth = 0;

    for (const v of neighbors) {
      const childDepth = 1 + getDepth(v, new Set(visited));
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    }

    memo.set(u, maxChildDepth);
    return maxChildDepth;
  };

  let overallMax = 0;
  for (const node of adj.keys()) {
    const d = getDepth(node);
    if (d > overallMax) overallMax = d;
  }

  return overallMax;
};

/**
 * Validates that adding candidateEdge does not introduce a cycle or exceed maximum graph depth.
 * Throws an ApiError if invalid.
 *
 * @param {Array<Object>} existingEdges
 * @param {Object} candidateEdge
 * @param {Object} [options]
 * @param {Map<string, string>} [options.nodeNameMap]
 * @param {number} [options.maxDepthLimit]
 * @returns {{isValid: boolean, maxDepth: number}}
 */
export const validateAcyclic = (
  existingEdges = [],
  candidateEdge,
  {
    nodeNameMap = new Map(),
    maxDepthLimit = GRAPH_LIMITS.MAX_DEPENDENCY_DEPTH,
  } = {},
) => {
  const from = String(
    candidateEdge.dependentId ||
      candidateEdge.dependentMonitor ||
      candidateEdge.dependent,
  );
  const to = String(
    candidateEdge.dependencyId ||
      candidateEdge.dependencyMonitor ||
      candidateEdge.dependencyExternalService ||
      candidateEdge.dependency,
  );

  if (from === to) {
    throw ApiError.badRequest(
      "A service cannot depend on itself (self-dependency rejected).",
      "SELF_DEPENDENCY_REJECTED",
    );
  }

  const { hasCycle, formattedCycle } = detectCycle(
    existingEdges,
    candidateEdge,
    nodeNameMap,
  );
  if (hasCycle) {
    throw ApiError.badRequest(
      `Cyclic dependency detected: ${formattedCycle}. A service cannot depend on a service that depends on it.`,
      "CYCLE_DETECTED",
    );
  }

  const maxDepth = calculateMaxDepth(existingEdges, candidateEdge);
  if (maxDepth > maxDepthLimit) {
    throw ApiError.badRequest(
      `Dependency chain exceeds maximum allowed depth of ${maxDepthLimit} hops (current would be ${maxDepth}).`,
      "MAX_DEPTH_EXCEEDED",
    );
  }

  return { isValid: true, maxDepth };
};
