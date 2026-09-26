'use client';

import { useState, useCallback, useRef, useEffect, useMemo, type MutableRefObject } from 'react';
import RepositorySelector from './components/RepositorySelector';
import RepoGraph from './components/repo-graph/RepoGraph';
import TabSidebar from './components/TabSidebar';
import type { TabId } from './components/TabSidebar';
import GraphToolbar from './components/graph/GraphToolbar';
import StatsToolbar from './components/stats/StatsToolbar';
import StatsTreemap from './components/stats/StatsTreemap';
import { SelectionProvider, useSelection, useSelectionState } from './contexts/SelectionContext';
import SearchSelectSidebar from './components/selection/SearchSelectSidebar';
import ManageSelectionSidebar from './components/selection/ManageSelectionSidebar';
import AreaManagerView from './components/areas/AreaManagerView';
import {
  INTERNAL_PROCESSING_CONFIG,
  createModulesViewConfig,
  createDataFlowViewConfig,
  DEFAULT_REPO_GRAPH_CONFIG,
} from '@/lib/analysis/graph-config';
import type { RepoGraphConfig } from '@/lib/analysis/graph-config';
import type { AnalysisEdge, AnalysisNode, AnalysisResult } from '@/lib/analysis/types';
import { AreaProvider } from '@/app/contexts/AreaContext';
import type { Area } from '@/lib/areas/types';
import CompareBar from './components/diff/CompareBar';
import DiffStatePanel from './components/diff/DiffStatePanel';
import { useDiff } from './components/diff/useDiff';

const VIEW_OPTIONS: Record<string, {
  label: string;
  config: RepoGraphConfig | ((edges: AnalysisEdge[], nodes: AnalysisNode[]) => RepoGraphConfig);
}> = {
  internal: { label: 'Internal Processing', config: INTERNAL_PROCESSING_CONFIG },
  modules: { label: 'Modules', config: createModulesViewConfig },
  dataflow: { label: 'Data Flow', config: createDataFlowViewConfig },
};

function ManageSelectionSidebarWrapper({ repoPath }: { repoPath: string }) {
  const { activeNodeIds } = useSelection();
  return <ManageSelectionSidebar effectiveNodeIds={[...activeNodeIds]} repoPath={repoPath} />;
}

function SelectionBridge({ toggleRef, pendingId, onPendingConsumed }: {
  toggleRef: MutableRefObject<((id: string) => void) | null>;
  pendingId: string | null;
  onPendingConsumed: () => void;
}) {
  const { toggleNode, state: { selectedNodeIds } } = useSelection();

  useEffect(() => {
    toggleRef.current = (id: string) => {
      if (!selectedNodeIds.has(id)) toggleNode(id);
    };

    return () => {
      toggleRef.current = null;
    };
  }, [toggleNode, selectedNodeIds, toggleRef]);

  useEffect(() => {
    if (pendingId && !selectedNodeIds.has(pendingId)) {
      toggleNode(pendingId);
      onPendingConsumed();
    }
  }, [pendingId, toggleNode, selectedNodeIds, onPendingConsumed]);

  return null;
}

/**
 * Main application page that orchestrates repository selection, analysis,
 * and graph visualization.
 *
 * @remarks
 * Top-level state holder for repo path, analysis data, active tab, and
 * search/selections. Renders the appropriate view (graph, stats, areas,
 * or diff) based on the active tab. Coordinate transforms occur at this
 * level so child components share the same projection.
 */
export default function HomePage() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [hideTestFiles, setHideTestFiles] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('graph');
  const [topN, setTopN] = useState(20);
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);

  // Graph toolbar state
  const [selectedView, setSelectedView] = useState<string>('modules');
  const searchHandlerRef = useRef<((query: string) => boolean) | null>(null);
  const selectionToggleRef = useRef<((id: string) => void) | null>(null);

  // Lifted data state
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areasData, setAreasData] = useState<Area[]>([]);

  // Diff tab state
  const diffState = useDiff(repoPath);
  // Fetch data when repoPath or hideTestFiles changes
  useEffect(() => {
    if (!repoPath) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/repo-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, hideTestFiles }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((result) => {
        if (result.success) {
          setAnalysisData(result.data);
        } else {
          setError(result.error || 'Analysis failed');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Network error');
        setLoading(false);
      });

    return () => controller.abort();
  }, [repoPath, hideTestFiles]);

  // Load areas after analysis succeeds
  useEffect(() => {
    if (!repoPath || !analysisData) {
      setAreasData([]);
      return;
    }
    const controller = new AbortController();
    fetch('/api/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load', repoPath }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data?.areas) {
          setAreasData(result.data.areas);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        // Silently fail — areas are optional
      });
    return () => controller.abort();
  }, [repoPath, analysisData]);

  // Compute which node IDs are visible in the current graph view.
  // Mirrors the filtering logic in RepoGraph so treemap knows which nodes are clickable.
  const computeVisibleNodeIds = useCallback((data: AnalysisResult | null) => {
    if (!data) return new Set<string>();
    const rawConfig = VIEW_OPTIONS[selectedView].config;
    const cfg = typeof rawConfig === 'function'
      ? rawConfig(data.edges, data.nodes)
      : (rawConfig ?? DEFAULT_REPO_GRAPH_CONFIG);
    const candidateIds = new Set(data.nodes.filter(cfg.filters.node).map((n) => n.scipSymbol));
    const connectedIds = new Set<string>();
    for (const e of data.edges) {
      if (cfg.filters.edge(e) && candidateIds.has(e.fromSymbol) && candidateIds.has(e.toSymbol)) {
        connectedIds.add(e.fromSymbol);
        connectedIds.add(e.toSymbol);
      }
    }
    return connectedIds;
  }, [selectedView]);

  const graphVisibleNodeIds = useMemo(() => computeVisibleNodeIds(analysisData), [computeVisibleNodeIds, analysisData]);

  // Git diff data
  const diffData = diffState.result?.success && diffState.result.state === 'ok' ? diffState.result.data : null;
  const diffVisibleNodeIds = useMemo(() => computeVisibleNodeIds(diffData), [computeVisibleNodeIds, diffData]);
  const diffLockedNodeIds = useMemo(
    () => new Set(
      (diffData?.nodes ?? [])
        .filter((n) => n.diffStatus && n.diffStatus !== 'unchanged')
        .map((n) => n.scipSymbol),
    ),
    [diffData],
  );

  // Per-tab selection state — hooks always called at top level
  const graphSelectionState = useSelectionState({
    nodes: analysisData?.nodes ?? [],
    edges: analysisData?.edges ?? [],
    visibleNodeIds: graphVisibleNodeIds,
    areas: areasData,
  });

  const diffSelectionState = useSelectionState({
    nodes: diffData?.nodes ?? [],
    edges: diffData?.edges ?? [],
    visibleNodeIds: diffVisibleNodeIds,
    areas: areasData,
    seedNodeIds: diffLockedNodeIds,
  });

  const handleRepositorySelect = useCallback((path: string) => {
    setRepoPath(path);
  }, []);

  const handleRegisterSearch = useCallback((handler: (query: string) => boolean) => {
    searchHandlerRef.current = handler;
  }, []);

  const handleNodeSelect = useCallback((scipSymbol: string) => {
    setActiveTab('graph');
    setPendingSelectionId(scipSymbol);
  }, []);

  // The RepoGraph workspace shared by the graph tab and the git diff tab.
  // Takes a pre-built selection value for per-tab persistence.
  const renderGraphView = (opts: {
    data: AnalysisResult | null;
    visibleNodeIds: Set<string>;
    isLoading: boolean;
    err: string | null;
    selectionValue: ReturnType<typeof useSelectionState>;
    bridgeSelection?: boolean;
  }) => (
    <SelectionProvider value={opts.selectionValue}>
      <AreaProvider areas={areasData} repoPath={repoPath} onAreasChange={setAreasData}>
        {opts.bridgeSelection && (
          <SelectionBridge
            toggleRef={selectionToggleRef}
            pendingId={pendingSelectionId}
            onPendingConsumed={() => setPendingSelectionId(null)}
          />
        )}
        <div style={{ display: 'flex', width: '100%', height: '100%', gap: 8 }}>
          <SearchSelectSidebar
            nodes={opts.data?.nodes ?? []}
            edges={opts.data?.edges ?? []}
            onSearchNode={(query) => searchHandlerRef.current?.(query) ?? false}
            repoPath={repoPath}
          />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <GraphToolbar
              hideTestFiles={hideTestFiles}
              onHideTestFilesChange={setHideTestFiles}
              selectedView={selectedView}
              onViewChange={setSelectedView}
              viewOptions={VIEW_OPTIONS}
              disabled={!repoPath}
            />
            <div style={{ flex: 1, minHeight: 0 }}>
              <RepoGraph
                repoPath={repoPath}
                hideTestFiles={hideTestFiles}
                config={VIEW_OPTIONS[selectedView].config}
                onSearchNode={handleRegisterSearch}
                analysisData={opts.data}
                loading={opts.isLoading}
                error={opts.err}
              />
            </div>
          </div>
          <ManageSelectionSidebarWrapper repoPath={repoPath} />
        </div>
      </AreaProvider>
    </SelectionProvider>
  );

  return (
    <main className="h-screen flex flex-col p-2 gap-2 overflow-hidden">
      {/* Row 1: Repository Selector */}
      <div className="shrink-0">
        <RepositorySelector
          onRepositorySelected={handleRepositorySelect}
          currentPath={repoPath}
        />
      </div>

      {/* Row 2: Tab content area */}
      <div className="flex-1 min-h-0 flex">
        {/* Sidebar */}
        <TabSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Toolbar (per-tab) */}
          {activeTab === 'stats' && (
            <StatsToolbar
              topN={topN}
              onTopNChange={setTopN}
              hideTestFiles={hideTestFiles}
              onHideTestFilesChange={setHideTestFiles}
              disabled={!repoPath}
            />
          )}

          {/* Content */}
          <div className="flex-1 min-h-0">
            {!repoPath ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
                Select a repository to visualize
              </div>
            ) : activeTab === 'areas' ? (
              <AreaProvider areas={areasData} repoPath={repoPath} onAreasChange={setAreasData}>
                <AreaManagerView
                  repoPath={repoPath}
                  nodes={analysisData?.nodes ?? []}
                />
              </AreaProvider>
            ) : activeTab === 'diff' ? (
              <div className="h-full min-w-0 flex flex-col gap-2">
                <CompareBar diffState={diffState} />
                <div
                  className={
                    diffData && !diffState.loading
                      ? 'flex-1 min-h-0'
                      : 'flex-1 min-h-0 bg-white border border-gray-200 rounded-md overflow-hidden'
                  }
                >
                  {(() => {
                    if (!diffState.compare || (!diffState.loading && !diffState.result)) {
                      return <DiffStatePanel state="empty" />;
                    }
                    if (diffState.loading && diffState.result) {
                      // Keep previous result visible; DiffStatePanel returns null
                      return <DiffStatePanel state="loading" hasPreviousResult={true} />;
                    }
                    if (diffState.loading) {
                      return <DiffStatePanel state="loading" />;
                    }
                    if (!diffState.result?.success) {
                      return (
                        <DiffStatePanel
                          state="error"
                          errorCode={diffState.result?.code}
                          errorMessage={diffState.error || diffState.result?.error}
                        />
                      );
                    }
                    if (diffState.result.state === 'no-changes') {
                      return <DiffStatePanel state="no-changes" />;
                    }
                    return renderGraphView({
                      data: diffData,
                      visibleNodeIds: diffVisibleNodeIds,
                      isLoading: false,
                      err: null,
                      selectionValue: diffSelectionState,
                    });
                  })()}
                </div>
              </div>
            ) : activeTab === 'graph' ? (
              renderGraphView({
                data: analysisData,
                visibleNodeIds: graphVisibleNodeIds,
                isLoading: loading,
                err: error,
                selectionValue: graphSelectionState,
                bridgeSelection: true,
              })
            ) : (
              analysisData ? (
                <StatsTreemap
                  nodes={analysisData.nodes}
                  topN={topN}
                  hideTestFiles={hideTestFiles}
                  onNodeSelect={handleNodeSelect}
                  graphVisibleNodeIds={graphVisibleNodeIds}
                />
              ) : loading ? (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  Analyzing repository...
                </div>
              ) : error ? (
                <div className="w-full h-full flex items-center justify-center text-red-500">
                  {error}
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
