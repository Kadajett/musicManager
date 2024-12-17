import React from 'react';
import { FaArrowLeft } from 'react-icons/fa';

interface FileBrowserHeaderProps {
  currentPath: string;
  onBack: () => void;
  onNavigate: (path: string) => void;
}

export function FileBrowserHeader({ currentPath, onBack, onNavigate }: FileBrowserHeaderProps) {
  const getBreadcrumbs = (path: string) => {
    const parts = path.split('/').filter(Boolean);
    const breadcrumbs = parts.map((part, index) => {
      const fullPath = '/' + parts.slice(0, index + 1).join('/');
      return { name: part, path: fullPath };
    });
    return [{ name: 'Root', path: '/' }, ...breadcrumbs];
  };

  return (
    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center">
        <button
          onClick={onBack}
          className="mr-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Go back"
        >
          <FaArrowLeft className="text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex items-center overflow-x-auto whitespace-nowrap">
          {getBreadcrumbs(currentPath).map((crumb, index, array) => (
            <React.Fragment key={crumb.path}>
              <button
                onClick={() => onNavigate(crumb.path)}
                className="text-blue-900 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-400 truncate max-w-[150px]"
                title={crumb.name}
              >
                {crumb.name}
              </button>
              {index < array.length - 1 && (
                <span className="mx-2 text-gray-400">/</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
} 