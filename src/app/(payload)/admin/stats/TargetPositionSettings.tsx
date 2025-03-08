'use client';

import React, { useState, useEffect } from 'react';
import { useConfig } from '@payloadcms/ui';

const TargetPositionSettings = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targetSize, setTargetSize] = useState<number>(25000);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const config = useConfig();
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.PAYLOAD_PUBLIC_SERVER_URL || '';
  
  // Fetch current user and their preferences
  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      
      try {
        const response = await fetch(`${baseUrl}/api/users/me`);
        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
          
          // Set target size from user preferences if available
          if (userData.preferences?.targetPositionSize) {
            setTargetSize(userData.preferences.targetPositionSize);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUser();
  }, [baseUrl]);
  
  // Function to save target position size
  const saveTargetSize = async () => {
    if (!currentUser) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      // Update user preferences
      const response = await fetch(`${baseUrl}/api/users/${currentUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences: {
            ...(currentUser.preferences || {}),
            targetPositionSize: targetSize,
          }
        }),
      });
      
      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: 'Target position size updated successfully. Future trades will use this new value.' 
        });
      } else {
        setMessage({ type: 'error', text: 'Failed to update target position size.' });
      }
    } catch (error) {
      console.error('Error saving target position size:', error);
      setMessage({ type: 'error', text: 'An error occurred while saving.' });
    } finally {
      setSaving(false);
    }
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  
  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }
  
  return (
    <div className="settings-container">
      <h3>Target Position Size Settings</h3>
      <p className="description">
        This sets your standard position size for normalization calculations.
        Existing trades will keep their original target size values.
        Only new trades will use this updated target size.
      </p>
      
      <div className="form-group">
        <label htmlFor="targetSize">Target Position Size:</label>
        <div className="input-wrapper">
          <input
            id="targetSize"
            type="number"
            value={targetSize}
            onChange={(e) => setTargetSize(Math.max(1, parseInt(e.target.value) || 0))}
            min="1"
            step="1000"
          />
          <span className="formatted-value">{formatCurrency(targetSize)}</span>
        </div>
      </div>
      
      <button 
        className="save-button"
        onClick={saveTargetSize}
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
      
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
      
      <style jsx>{`
        .settings-container {
          margin-top: 30px;
          padding: 20px;
          background-color: #f5f5f5;
          border-radius: 8px;
          max-width: 600px;
        }
        
        h3 {
          margin-top: 0;
          margin-bottom: 10px;
        }
        
        .description {
          margin-bottom: 20px;
          font-size: 14px;
          color: #666;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        
        .input-wrapper {
          display: flex;
          align-items: center;
        }
        
        input {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          width: 150px;
        }
        
        .formatted-value {
          margin-left: 10px;
          font-size: 16px;
          color: #666;
        }
        
        .save-button {
          padding: 8px 16px;
          background-color: #4a6cf7;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }
        
        .save-button:hover {
          background-color: #3a5bd7;
        }
        
        .save-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .message {
          margin-top: 15px;
          padding: 10px;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .success {
          background-color: #e6f7e6;
          color: #2e7d32;
          border: 1px solid #c8e6c9;
        }
        
        .error {
          background-color: #ffebee;
          color: #c62828;
          border: 1px solid #ffcdd2;
        }
        
        .loading {
          text-align: center;
          padding: 20px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default TargetPositionSettings;