import React, { useState, useEffect } from 'react';

const DebugPanel = ({ logs = [], onClear, visible = false, onToggle }) => {
  const [filter, setFilter] = useState('all');
  
  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'encryption') return log.message.toLowerCase().includes('encrypt');
    if (filter === 'socket') return log.message.toLowerCase().includes('socket') || log.message.toLowerCase().includes('connect');
    if (filter === 'message') return log.message.toLowerCase().includes('message');
    return true;
  });

  const formatData = (data) => {
    if (!data) return '';
    if (typeof data === 'string') return data;
    
    // Special formatting for encryption data
    if (data.iv && data.encrypted) {
      return `IV: ${data.iv.slice(0, 16)}...\nEncrypted: ${data.encrypted.slice(0, 32)}...\nAlgorithm: ${data.algorithm || 'custom'}`;
    }
    
    return JSON.stringify(data, null, 2);
  };

  const getLogTypeColor = (message) => {
    const msg = message.toLowerCase();
    if (msg.includes('error') || msg.includes('failed')) return '#ff6b6b';
    if (msg.includes('encrypt') || msg.includes('decrypt')) return '#4ecdc4';
    if (msg.includes('connect') || msg.includes('join')) return '#45b7d1';
    if (msg.includes('message')) return '#96ceb4';
    return '#feca57';
  };

  if (!visible) {
    return (
      <button 
        className="debug-toggle"
        onClick={onToggle}
        title="Show encryption debug panel"
      >
        🔍
      </button>
    );
  }

  return (
    <>
      <button 
        className="debug-toggle debug-toggle--active"
        onClick={onToggle}
        title="Hide debug panel"
      >
        ✕
      </button>
      
      <div className="debug-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4>🔐 Encryption Debug ({filteredLogs.length})</h4>
          <button 
            onClick={onClear}
            style={{ 
              padding: '4px 8px', 
              background: '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: '3px',
              fontSize: '10px'
            }}
          >
            Clear
          </button>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            style={{ 
              padding: '4px', 
              fontSize: '11px', 
              background: '#495057', 
              color: 'white', 
              border: 'none',
              borderRadius: '3px'
            }}
          >
            <option value="all">All Logs</option>
            <option value="encryption">Encryption</option>
            <option value="socket">Socket</option>
            <option value="message">Messages</option>
          </select>
        </div>
        
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {filteredLogs.length === 0 ? (
            <p style={{ color: '#adb5bd', fontStyle: 'italic' }}>No logs to display...</p>
          ) : (
            filteredLogs.map((log, index) => (
              <div key={index} style={{ marginBottom: '8px', fontSize: '11px', lineHeight: '1.3' }}>
                <div style={{ 
                  color: getLogTypeColor(log.message),
                  fontWeight: 'bold'
                }}>
                  [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                </div>
                {log.data && (
                  <pre style={{ 
                    color: '#e9ecef', 
                    marginLeft: '10px', 
                    marginTop: '4px',
                    fontSize: '10px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {formatData(log.data)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
        
        <div style={{ 
          marginTop: '10px', 
          padding: '8px', 
          background: 'rgba(255, 255, 255, 0.1)', 
          borderRadius: '4px',
          fontSize: '10px'
        }}>
          <strong>Security Demo:</strong> This panel shows real-time encryption operations including base64 payloads, 
          IV generation, and secure tunneling events for cybersecurity demonstration purposes.
        </div>
      </div>
    </>
  );
};

export default DebugPanel;
