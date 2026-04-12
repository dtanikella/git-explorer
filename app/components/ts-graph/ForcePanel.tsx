import { useState } from 'react';
import { NodeForceRule, EdgeForceRule } from '@/lib/ts/types';

interface ForcePanelProps {
  nodeRules: NodeForceRule[];
  edgeRules: EdgeForceRule[];
  onNodeRulesChange: (rules: NodeForceRule[]) => void;
  onEdgeRulesChange: (rules: EdgeForceRule[]) => void;
  hideTestFiles: boolean;
  onHideTestFilesChange: (value: boolean) => void;
  onSearchNode: (query: string) => boolean;
}

export default function ForcePanel({
  nodeRules,
  edgeRules,
  onNodeRulesChange,
  onEdgeRulesChange,
  hideTestFiles,
  onHideTestFilesChange,
  onSearchNode,
}: ForcePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNotFound, setSearchNotFound] = useState(false);

  function handleSearch() {
    if (!searchQuery.trim()) return;
    const found = onSearchNode(searchQuery.trim());
    setSearchNotFound(!found);
  }
  function toggleNodeRule(id: string) {
    onNodeRulesChange(
      nodeRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  }

  function updateNodeForce(id: string, key: string, value: number) {
    onNodeRulesChange(
      nodeRules.map((r) =>
        r.id === id ? { ...r, forces: { ...r.forces, [key]: value } } : r
      )
    );
  }

  function updateNodeStyle(id: string, key: string, value: string | number) {
    onNodeRulesChange(
      nodeRules.map((r) =>
        r.id === id ? { ...r, style: { ...r.style, [key]: value } } : r
      )
    );
  }

  function toggleEdgeRule(id: string) {
    onEdgeRulesChange(
      edgeRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  }

  function updateEdgeForce(id: string, key: string, value: number) {
    onEdgeRulesChange(
      edgeRules.map((r) =>
        r.id === id ? { ...r, forces: { ...r.forces, [key]: value } } : r
      )
    );
  }

  function updateEdgeStyle(id: string, key: string, value: string | number) {
    onEdgeRulesChange(
      edgeRules.map((r) =>
        r.id === id ? { ...r, style: { ...r.style, [key]: value } } : r
      )
    );
  }

  return (
    <div
      style={{
        width: 280,
        height: '100%',
        overflowY: 'auto',
        borderLeft: '1px solid #e5e7eb',
        padding: 12,
        fontSize: 13,
        background: '#fafafa',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchNotFound(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Search node..."
            style={{ flex: 1, padding: '4px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 4 }}
          />
          <button
            onClick={handleSearch}
            style={{ padding: '4px 10px', fontSize: 13, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Search
          </button>
        </div>
        {searchNotFound && (
          <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>No matching node found</div>
        )}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={hideTestFiles}
          onChange={(e) => onHideTestFilesChange(e.target.checked)}
        />
        Hide test files
      </label>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
        Node Rules
      </h3>
      {nodeRules.map((rule) => (
        <div
          key={rule.id}
          style={{
            marginBottom: 12,
            padding: 8,
            background: '#fff',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            opacity: rule.enabled ? 1 : 0.5,
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={() => toggleNodeRule(rule.id)}
            />
            <span style={{ fontWeight: 500 }}>{rule.label}</span>
          </label>
          {rule.enabled && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {rule.forces && (
                <>
                  {rule.forces.charge !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Charge</span>
                      <input
                        type="number"
                        value={rule.forces.charge}
                        onChange={(e) => updateNodeForce(rule.id, 'charge', Number(e.target.value))}
                        style={{ width: 70, textAlign: 'right' }}
                      />
                    </div>
                  )}
                  {rule.forces.collideRadius !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Collide R</span>
                      <input
                        type="number"
                        value={rule.forces.collideRadius}
                        onChange={(e) => updateNodeForce(rule.id, 'collideRadius', Number(e.target.value))}
                        style={{ width: 70, textAlign: 'right' }}
                      />
                    </div>
                  )}
                  {rule.forces.centerStrength !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Center</span>
                      <input
                        type="number"
                        step="0.1"
                        value={rule.forces.centerStrength}
                        onChange={(e) => updateNodeForce(rule.id, 'centerStrength', Number(e.target.value))}
                        style={{ width: 70, textAlign: 'right' }}
                      />
                    </div>
                  )}
                </>
              )}
              {rule.style && (
                <>
                  {rule.style.color !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Color</span>
                      <input
                        type="color"
                        value={rule.style.color}
                        onChange={(e) => updateNodeStyle(rule.id, 'color', e.target.value)}
                        style={{ width: 32, height: 24, border: 'none', cursor: 'pointer' }}
                      />
                    </div>
                  )}
                  {rule.style.radius !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Radius</span>
                      <input
                        type="number"
                        value={rule.style.radius}
                        onChange={(e) => updateNodeStyle(rule.id, 'radius', Number(e.target.value))}
                        style={{ width: 70, textAlign: 'right' }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}

      <h3 style={{ margin: '16px 0 12px', fontSize: 14, fontWeight: 600 }}>
        Edge Rules
      </h3>
      {edgeRules.map((rule) => (
        <div
          key={rule.id}
          style={{
            marginBottom: 12,
            padding: 8,
            background: '#fff',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            opacity: rule.enabled ? 1 : 0.5,
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={() => toggleEdgeRule(rule.id)}
            />
            <span style={{ fontWeight: 500 }}>{rule.label}</span>
          </label>
          {rule.enabled && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {rule.forces && (
                <>
                  {rule.forces.linkDistance !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Distance</span>
                      <input
                        type="number"
                        value={rule.forces.linkDistance}
                        onChange={(e) => updateEdgeForce(rule.id, 'linkDistance', Number(e.target.value))}
                        style={{ width: 70, textAlign: 'right' }}
                      />
                    </div>
                  )}
                  {rule.forces.linkStrength !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Strength</span>
                      <input
                        type="number"
                        step="0.1"
                        value={rule.forces.linkStrength}
                        onChange={(e) => updateEdgeForce(rule.id, 'linkStrength', Number(e.target.value))}
                        style={{ width: 70, textAlign: 'right' }}
                      />
                    </div>
                  )}
                </>
              )}
              {rule.style && (
                <>
                  {rule.style.color !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Color</span>
                      <input
                        type="color"
                        value={rule.style.color}
                        onChange={(e) => updateEdgeStyle(rule.id, 'color', e.target.value)}
                        style={{ width: 32, height: 24, border: 'none', cursor: 'pointer' }}
                      />
                    </div>
                  )}
                  {rule.style.width !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Width</span>
                      <input
                        type="number"
                        step="0.5"
                        value={rule.style.width}
                        onChange={(e) => updateEdgeStyle(rule.id, 'width', Number(e.target.value))}
                        style={{ width: 70, textAlign: 'right' }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
