import { PlayerProvider } from "./context/PlayerContext";
import { FileBrowser } from "./components/FileBrowser";
import { PlayerFooter } from './components/PlayerFooter';
import { useDevices } from './hooks/useDevices';
import { useDeviceNavigation } from './hooks/useDeviceNavigation';
import { DeviceBrowser } from './components/DeviceBrowser';
import { useDevice } from "./context/DeviceContext";

function App() {
  const devices = useDevices();
  const { selectDevice, selectedDevice } = useDevice();

  return (
    <PlayerProvider>
      
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="flex h-screen">
            {/* Left Navigation */}
            <div className="w-1/3 md:w-1/4 lg:w-1/6 border-r border-gray-200 dark:border-gray-700 p-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Music Manager
              </h1>
              <nav>
                <ul className="space-y-2">
                  <li>
                    <a href="#" className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                      <span className="mr-3">📁</span>
                      Browse Files
                    </a>
                  </li>
                  <li>
                    <a href="#" className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                      <span className="mr-3">🏷️</span>
                      Metadata Editor
                    </a>
                  </li>
                  {/* Device Transfer section with connected devices */}
                  <li>
                    <div className="px-4 py-2 text-gray-700 dark:text-gray-200">
                      <div className="flex items-center mb-2">
                        <span className="mr-3">📱</span>
                        Device Transfer
                      </div>
                      {devices.length > 0 ? (
                        <ul className="ml-8 space-y-1">
                          {devices.map((device) => (
                            <li key={device.path}>
                              <button
                                onClick={() => selectDevice(device)}
                                className={`flex items-center text-sm py-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white ${
                                  selectedDevice?.path === device.path ? 'bg-gray-100 dark:bg-gray-800' : ''
                                }`}
                              >
                                {device.removable ? '📱' : '💾'} {device.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="ml-8 text-sm text-gray-500 dark:text-gray-400">
                          No devices connected
                        </p>
                      )}
                    </div>
                  </li>
                  <li>
                    <a href="#" className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                      <span className="mr-3">✅</span>
                      Validation
                    </a>
                  </li>
                </ul>
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
              <div className={`${selectedDevice ? 'w-1/2' : 'w-full'} h-full`}>
                <FileBrowser />
              </div>
              {selectedDevice && (
                <div className="w-1/2 h-full border-l border-gray-200 dark:border-gray-700">
                  <DeviceBrowser />
                </div>
              )}
            </div>

            {/* Player sidebar */}
            <div className="w-96">
              <PlayerFooter />
            </div>
          </div>
        </div>
      
    </PlayerProvider>
  );
}

export default App;
