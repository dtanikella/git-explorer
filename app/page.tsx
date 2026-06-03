'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import RepositorySelector from './components/RepositorySelector';
import RepoGraph from './components/repo-graph/RepoGraph';
import TabSidebar from './components/TabSidebar';
import type { TabId } from './components/TabSidebar';
import GraphToolbar from './components/graph/GraphToolbar';
import StatsToolbar from './components/stats/StatsToolbar';
import StatsTreemap from './components/stats/StatsTreemap';
import { INTERNAL_PROCESSING_CONFIG, createModulesViewConfig, DEFAULT_REPO_GRAPH_CONFIG } from '@/lib/analysis/graph-config';
import type { RepoGraphConfig } from '@/lib/analysis/graph-config';
import type { AnalysisEdge, AnalysisResult } from '@/lib/analysis/types';

const VIEW_OPTIONS: Record<string, { label: string; config: RepoGraphConfig | ((edges: AnalysisEdge[]) => RepoGraphConfig) }> = {
  internal: { label: 'Internal Processing', config: INTERNAL_PROCESSING_CONFIG },
  modules: { label: 'Modules', config: createModulesViewConfig },
};

export default function HomePage() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [hideTestFiles, setHideTestFiles] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('graph');
  const [topN, setTopN] = useState(20);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  // Graph toolbar state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [selectedView, setSelectedView] = useState<string>('modules');
  const searchHandlerRef = useRef<((query: string) => boolean) | null>(null);

  // Lifted data state
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Compute which node IDs are visible in the current graph view.
  // Mirrors the filtering logic in RepoGraph so treemap knows which nodes are clickable.
  const graphVisibleNodeIds = useMemo(() => {
    if (!analysisData) return new Set<string>();
    const rawConfig = VIEW_OPTIONS[selectedView].config;
    const cfg = typeof rawConfig === 'function' ? rawConfig(analysisData.edges) : (rawConfig ?? DEFAULT_REPO_GRAPH_CONFIG);
    const candidateIds = new Set(analysisData.nodes.filter(cfg.filters.node).map((n) => n.scipSymbol));
    const connectedIds = new Set<string>();
    for (const e of analysisData.edges) {
      if (cfg.filters.edge(e) && candidateIds.has(e.fromSymbol) && candidateIds.has(e.toSymbol)) {
        connectedIds.add(e.fromSymbol);
        connectedIds.add(e.toSymbol);
      }
    }
    return connectedIds;
  }, [analysisData, selectedView]);

  const handleRepositorySelect = useCallback((path: string) => {
    setRepoPath(path);
  }, []);

  const handleRegisterSearch = useCallback((handler: (query: string) => boolean) => {
    searchHandlerRef.current = handler;
  }, []);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    if (searchHandlerRef.current) {
      const found = searchHandlerRef.current(searchQuery.trim());
      setSearchNotFound(!found);
    }
  }, [searchQuery]);

  const handleNodeSelect = useCallback((scipSymbol: string) => {
    setHighlightedNodeId(scipSymbol);
    setActiveTab('graph');
  }, []);

  // Clear highlight after tab switch completes
  useEffect(() => {
    if (highlightedNodeId && activeTab === 'graph') {
      const timer = setTimeout(() => setHighlightedNodeId(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [highlightedNodeId, activeTab]);

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
          {activeTab === 'graph' && (
            <GraphToolbar
              hideTestFiles={hideTestFiles}
              onHideTestFilesChange={setHideTestFiles}
              selectedView={selectedView}
              onViewChange={setSelectedView}
              viewOptions={VIEW_OPTIONS}
              searchQuery={searchQuery}
              onSearchQueryChange={(q) => { setSearchQuery(q); setSearchNotFound(false); }}
              onSearch={handleSearch}
              searchNotFound={searchNotFound}
              disabled={!repoPath}
            />
          )}
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
            ) : activeTab === 'graph' ? (
              <RepoGraph
                repoPath={repoPath}
                hideTestFiles={hideTestFiles}
                config={VIEW_OPTIONS[selectedView].config}
                onSearchNode={handleRegisterSearch}
                analysisData={analysisData}
                loading={loading}
                error={error}
                highlightedNodeId={highlightedNodeId}
              />
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
