import React, { useState, useEffect } from 'react';
import { ApiClient } from '../utils/api-client'; // Using the central configured API utility

interface ProgressData {
  completedAssessments: number;
  totalAssessments: number;
  velocityScore: number;
}

/**
 * ProgressTracking Component visualizing patient treatment and assessment milestones.
 * Migrated from raw fetch calls to ApiClient to resolve origin resolution failures.
 */
export const ProgressTracking: React.FC = () => {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgressMetrics = async () => {
      try {
        // ApiClient handles VITE_API_BASE injection and cross-origin authentication headers natively
        const response = await ApiClient.get<{ success: boolean; data: ProgressData }>('/analytics/progress');
        
        if (response.data && response.data.success) {
          setProgress(response.data.data);
        } else {
          throw new Error('Failed to parse validation signature from analytics gateway.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to sync milestone data tracking records.');
      } finally {
        setLoading(false);
      }
    };

    fetchProgressMetrics();
  }, []);

  if (loading) return <div className="tracking-spinner">Syncing metric timelines...</div>;
  if (error) return <div className="tracking-error-banner">Metrics Pipeline Fault: {error}</div>;
  if (!progress) return <div className="tracking-empty">No trace metrics available for current snapshot.</div>;

  const completionPercentage = Math.round((progress.completedAssessments / progress.totalAssessments) * 100) || 0;

  return (
    <div className="progress-analytics-card">
      <h3>Clinical Analytics Milestone Tracker</h3>
      <div className="metric-row">
        <span>Completion Velocity:</span>
        <strong>{progress.velocityScore}%</strong>
      </div>
      <div className="progress-bar-wrapper">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
      <p className="caption">
        Processed {progress.completedAssessments} of {progress.totalAssessments} total assigned diagnostic items.
      </p>
    </div>
  );
};

export default ProgressTracking;
