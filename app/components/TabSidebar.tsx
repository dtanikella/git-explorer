'use client';

export type TabId = 'graph' | 'stats' | 'areas' | 'diff';

interface TabSidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

/**
 * Sidebar navigation for switching between the main views.
 *
 * @remarks
 * Provides a vertical tab list for Graph, Stats, Areas, and Diff views.
 * The active tab is visually highlighted.
 *
 * @param activeTab - The currently active tab ID.
 * @param onTabChange - Callback when the user clicks a different tab.
 */
export default function TabSidebar({ activeTab, onTabChange }: TabSidebarProps) {
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'graph',
      label: 'Graph',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5" cy="5" r="2" />
          <circle cx="15" cy="5" r="2" />
          <circle cx="10" cy="15" r="2" />
          <line x1="6.5" y1="6" x2="9" y2="13.5" />
          <line x1="13.5" y1="6" x2="11" y2="13.5" />
          <line x1="7" y1="5" x2="13" y2="5" />
        </svg>
      ),
    },
    {
      id: 'stats',
      label: 'Stats',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="10" width="4" height="8" rx="0.5" />
          <rect x="8" y="6" width="4" height="12" rx="0.5" />
          <rect x="14" y="2" width="4" height="16" rx="0.5" />
        </svg>
      ),
    },
    {
      id: 'areas',
      label: 'Areas',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="5" />
          <circle cx="13" cy="8" r="5" />
          <circle cx="10.5" cy="12" r="5" />
        </svg>
      ),
    },
    {
      id: 'diff',
      label: 'Diff',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <rect x="3.6" y="3.6" width="12.8" height="12.8" rx="2" transform="rotate(45 10 10)"/>
          <circle cx="10" cy="6.6" r="1.1" fill="currentColor"/>
          <circle cx="10" cy="13.4" r="1.1" fill="currentColor"/>
          <circle cx="13.2" cy="9.4" r="1.1" fill="currentColor"/>
          <line x1="10" y1="7.4" x2="10" y2="12.6"/>
          <path d="M10 8.4 L12.6 9.4"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col w-10 bg-gray-800 shrink-0 rounded-l-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          aria-label={tab.label}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center justify-center w-10 h-10 text-gray-400 hover:text-white transition-colors ${
            activeTab === tab.id ? 'border-l-2 border-blue-400 bg-gray-700 text-white' : ''
          }`}
        >
          {tab.icon}
        </button>
      ))}
    </div>
  );
}
