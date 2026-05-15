import React, { useState, useEffect, useRef } from 'react';
import { getVideoFeedUrl, fetchCameraStatus, updateCameraSource, uploadMedia, togglePause } from '../services/api';
import { toast } from 'react-hot-toast';

export default function VideoFeed() {
  const [error, setError] = useState(false);
  const [status, setStatus] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newSource, setNewSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedKey, setFeedKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCameraStatus().then(s => {
      setStatus(s);
      setIsPaused(s.paused || false);
    }).catch(console.error);
  }, [feedKey]);

  const handleTogglePause = async () => {
    try {
      const res = await togglePause();
      if (res.status === 'success') {
        setIsPaused(res.paused);
        toast.success(res.paused ? 'Stream paused' : 'Stream resumed');
      } else {
        toast.error('Failed to toggle pause');
      }
    } catch (err) {
      toast.error('Network error toggling pause');
    }
  };

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
    <div className="bg-white rounded-md overflow-hidden shadow-sm border border-slate-200 h-full flex flex-col">

      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        {/* Hidden File Input (Moved out of settings so Change Media button can access it) */}
        <input 
          type="file" 
          accept="video/*,image/*"
          className="hidden" 
          ref={fileInputRef}
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            setLoading(true);
            toast.loading('Uploading media...', { id: 'media-upload' });
            try {
              const res = await uploadMedia(file);
              if (res.status === 'success') {
                toast.success('Media uploaded successfully!', { id: 'media-upload' });
                setFeedKey(prev => prev + 1);
                setShowSettings(false);
                setError(false);
              } else {
                toast.error(res.message || 'Upload failed', { id: 'media-upload' });
              }
            } catch (err) {
              toast.error('Network error uploading media', { id: 'media-upload' });
            } finally {
              setLoading(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }
          }}
        />
        <div className="flex items-center gap-3">
          <h3 className="text-slate-800 font-bold uppercase tracking-widest text-sm">LIVE MONITOR</h3>
          {status && (
            <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-500 font-mono">
              src: {status.source}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Camera Settings"
          >
            <span className="text-lg">⚙</span>
          </button>
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-sm ${error ? 'bg-red-500' : 'bg-green-500 alert-pulse'}`}></span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{error ? 'Offline' : 'Live'}</span>
          </span>

        </div>
      </div>

      {showSettings && (
        <div className="p-4 bg-slate-50 border-b border-slate-200 backdrop-blur-sm">
          <form onSubmit={handleUpdateSource} className="flex gap-2 mb-3">
            <input 
              type="text" 
              placeholder="Source (0, 1, or URL)"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-green-500 shadow-sm"
            />
            <button 
              type="submit"
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Switch'}
            </button>
          </form>
          
          <div className="flex items-center gap-2">

            <button 
              type="button"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>📁</span> Upload Media for Detection
            </button>
          </div>
          
          <p className="text-[10px] text-slate-400 mt-2">
            * Use 0/1 for local webcams, enter DroidCam/IP URL, or upload a video/image file.
          </p>
        </div>
      )}

      <div className="relative bg-black flex-1 overflow-hidden">

        {!error ? (
          <>
            <img
              key={feedKey}
              src={`${getVideoFeedUrl()}?t=${feedKey}`}
              alt="Live waste detection feed"
              className="w-full h-full object-contain bg-black"
              onError={() => setError(true)}
            />
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button
                onClick={handleTogglePause}
                className="bg-slate-900/80 hover:bg-black/90 backdrop-blur-md text-white px-3 py-1.5 rounded-md text-xs font-bold tracking-wider transition-colors border border-slate-700/50 flex items-center gap-2 shadow-lg"
              >
                <span>{isPaused ? '▶ PLAY' : '⏸ PAUSE'}</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-900/80 hover:bg-black/90 backdrop-blur-md text-white px-3 py-1.5 rounded-md text-xs font-bold tracking-wider transition-colors border border-slate-700/50 flex items-center gap-2 shadow-lg"
              >
                <span>📁 CHANGE MEDIA</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <div className="w-16 h-16 mb-4 border-2 border-gray-600 rounded-none flex items-center justify-center text-2xl">
              ◉
            </div>
            <p className="text-sm">Camera feed unavailable</p>
            <p className="text-xs mt-1 text-gray-600">Source: {status?.source || 'Unknown'}</p>
            <button
              onClick={() => { setError(false); setFeedKey(prev => prev + 1); }}
              className="mt-4 px-6 py-2 bg-blue-600 text-white text-xs font-bold uppercase tracking-widest rounded-md hover:bg-blue-700 transition-all active:scale-95 shadow-lg"
            >

              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

