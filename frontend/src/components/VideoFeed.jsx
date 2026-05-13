import React, { useState, useEffect } from 'react';
import { getVideoFeedUrl, fetchCameraStatus, updateCameraSource } from '../services/api';
import { toast } from 'react-hot-toast';

export default function VideoFeed() {
  const [error, setError] = useState(false);
  const [status, setStatus] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newSource, setNewSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedKey, setFeedKey] = useState(0);

  useEffect(() => {
    fetchCameraStatus().then(setStatus).catch(console.error);
  }, [feedKey]);

  const handleUpdateSource = async (e) => {
    e.preventDefault();
    if (!newSource.trim()) return;
    
    setLoading(true);
    try {
      // Try to parse as int if possible
      const sourceVal = isNaN(newSource) ? newSource : parseInt(newSource);
      const res = await updateCameraSource(sourceVal);
      if (res.status === 'success') {
        toast.success(`Camera updated to: ${newSource}`);
        setFeedKey(prev => prev + 1);
        setShowSettings(false);
        setError(false);
      } else {
        toast.error(res.message || 'Failed to update camera');
      }
    } catch (err) {
      toast.error('Network error updating camera');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700">
      <div className="px-4 py-2.5 border-b border-gray-700 flex items-center justify-between bg-gray-800/50">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-semibold text-sm">AI Camera Feed - Waste Detection</h3>
          {status && (
            <span className="text-[10px] bg-gray-700 px-2 py-0.5 rounded text-gray-400 font-mono">
              src: {status.source}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="text-gray-400 hover:text-white transition-colors"
            title="Camera Settings"
          >
            <span className="text-lg">⚙</span>
          </button>
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500 alert-pulse'}`}></span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{error ? 'Offline' : 'Live'}</span>
          </span>
        </div>
      </div>

      {showSettings && (
        <div className="p-4 bg-gray-900/80 border-b border-gray-700 backdrop-blur-sm">
          <form onSubmit={handleUpdateSource} className="flex gap-2">
            <input 
              type="text" 
              placeholder="Source (0, 1, or URL)"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-green-500"
            />
            <button 
              type="submit"
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Switch'}
            </button>
          </form>
          <p className="text-[10px] text-gray-500 mt-2">
            * Use 0/1 for local webcams, or enter DroidCam/IP URL (e.g. http://192.168.1.10:4747/video)
          </p>
        </div>
      )}

      <div className="relative bg-black" style={{ minHeight: '380px' }}>
        {!error ? (
          <img
            key={feedKey}
            src={`${getVideoFeedUrl()}?t=${feedKey}`}
            alt="Live waste detection feed"
            className="w-full h-auto"
            onError={() => setError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <div className="w-16 h-16 mb-4 border-2 border-gray-600 rounded-full flex items-center justify-center text-2xl">
              ◉
            </div>
            <p className="text-sm">Camera feed unavailable</p>
            <p className="text-xs mt-1 text-gray-600">Source: {status?.source || 'Unknown'}</p>
            <button
              onClick={() => { setError(false); setFeedKey(prev => prev + 1); }}
              className="mt-4 px-6 py-2 bg-blue-600 text-white text-xs font-bold uppercase tracking-widest rounded-full hover:bg-blue-700 transition-all active:scale-95 shadow-lg"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
