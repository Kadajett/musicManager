import React from 'react';

interface Tab {
  id: string;
  label: string;
  path: string;
}

interface TabViewProps {
  tabs: Tab[];
  activeTab: string;
  onTabClick: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
}

export function TabView({ tabs, activeTab, onTabClick, onTabClose }: TabViewProps) {
  return (
    <div className="flex border-b border-gray-200 dark:border-gray-700">
      <div className="flex space-x-1 overflow-x-auto scrollbar-hide py-2 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`
              flex items-center px-4 py-2 rounded-lg text-sm font-medium
              transition-colors duration-150 ease-in-out
              ${activeTab === tab.id 
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }
            `}
          >
            <span className="truncate max-w-xs">{tab.label}</span>
            {onTabClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className="ml-2 hover:text-red-500 dark:hover:text-red-400"
              >
                ×
              </button>
            )}
          </button>
        ))}
      </div>
    </div>
  );
} 