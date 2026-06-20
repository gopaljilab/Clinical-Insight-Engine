import { useState, useEffect } from 'react';
import { ApiClient } from '../utils/api-client'; // Relying on the project's central baseline ApiClient

interface Assessment {
  id: string;
  title: string;
  score: number;
  createdAt: string;
}

/**
 * Custom hook managing clinical assessment data stream fetches.
 * Swaps out raw fetch constructs for ApiClient to inherit global cross-origin headers,
 * authentication interceptors, and environment URL contexts seamlessly.
 */
export const useAssessments = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      // ApiClient cleanly prefixes VITE_API_BASE and handles CORS credential sharing configuration
      const response = await ApiClient.get<{ success: boolean; data: Assessment[] }>('/assessments');
      
      if (response.data && response.data.success) {
        setAssessments(response.data.data);
      } else {
        throw new Error('Failed to parse assessment payload stream metadata context.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while tracking clinical evaluation entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  return { assessments, loading, error, refetch: fetchAssessments };
};
