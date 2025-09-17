import { useState, useEffect, useCallback } from 'react';

export interface ProcessingJob {
  id: string;
  videoUrl: string;
  videoTitle: string;
  videoThumbnail: string;
  status: 'processing' | 'completed' | 'error' | 'cancelled';
  progress: number;
  currentStep: string;
  steps: Array<{
    id: string;
    label: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress?: number;
    error?: string;
  }>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  capsuleId?: string;
}

export interface UseVideoProcessingReturn {
  jobs: ProcessingJob[];
  activeJobs: ProcessingJob[];
  completedJobs: ProcessingJob[];
  errorJobs: ProcessingJob[];
  startProcessing: (videoUrl: string, metadata: any) => Promise<string>;
  cancelProcessing: (jobId: string) => Promise<void>;
  retryProcessing: (jobId: string) => Promise<void>;
  removeJob: (jobId: string) => void;
  clearCompleted: () => void;
  isProcessing: boolean;
}

export const useVideoProcessing = (): UseVideoProcessingReturn => {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [wsConnections, setWsConnections] = useState<Map<string, WebSocket>>(new Map());

  // Load jobs from localStorage on mount
  useEffect(() => {
    const savedJobs = localStorage.getItem('videoProcessingJobs');
    if (savedJobs) {
      try {
        const parsedJobs = JSON.parse(savedJobs);
        setJobs(parsedJobs);
        
        // Reconnect to active jobs
        parsedJobs
          .filter((job: ProcessingJob) => job.status === 'processing')
          .forEach((job: ProcessingJob) => {
            connectToJob(job.id);
          });
      } catch (error) {
        console.error('Failed to load processing jobs:', error);
      }
    }
  }, []);

  // Save jobs to localStorage whenever jobs change
  useEffect(() => {
    localStorage.setItem('videoProcessingJobs', JSON.stringify(jobs));
  }, [jobs]);

  const connectToJob = useCallback((jobId: string) => {
    if (wsConnections.has(jobId)) {
      return; // Already connected
    }

    const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:3001'}/processing/${jobId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`Connected to processing job ${jobId}`);
    };

    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        handleProcessingUpdate(jobId, update);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error(`WebSocket error for job ${jobId}:`, error);
    };

    ws.onclose = () => {
      console.log(`Disconnected from processing job ${jobId}`);
      setWsConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(jobId);
        return newMap;
      });
    };

    setWsConnections(prev => new Map(prev).set(jobId, ws));
  }, [wsConnections]);

  const disconnectFromJob = useCallback((jobId: string) => {
    const ws = wsConnections.get(jobId);
    if (ws) {
      ws.close();
      setWsConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(jobId);
        return newMap;
      });
    }
  }, [wsConnections]);

  const handleProcessingUpdate = useCallback((jobId: string, update: any) => {
    setJobs(prev => prev.map(job => {
      if (job.id !== jobId) return job;

      const updatedJob = { ...job };

      // Update step status
      if (update.stepId) {
        updatedJob.steps = job.steps.map(step =>
          step.id === update.stepId
            ? {
                ...step,
                status: update.status,
                progress: update.progress,
                error: update.error,
              }
            : step
        );

        // Update current step
        if (update.status === 'processing') {
          updatedJob.currentStep = update.stepId;
        }
      }

      // Update overall progress
      if (update.progress !== undefined) {
        updatedJob.progress = update.progress;
      }

      // Handle completion
      if (update.type === 'completed') {
        updatedJob.status = 'completed';
        updatedJob.completedAt = new Date().toISOString();
        updatedJob.capsuleId = update.capsuleId;
        updatedJob.progress = 100;
      }

      // Handle errors
      if (update.type === 'error') {
        updatedJob.status = 'error';
        updatedJob.error = update.error;
      }

      return updatedJob;
    }));

    // Disconnect if job is completed or failed
    if (update.type === 'completed' || update.type === 'error') {
      disconnectFromJob(jobId);
    }
  }, [disconnectFromJob]);

  const startProcessing = useCallback(async (videoUrl: string, metadata: any): Promise<string> => {
    try {
      const response = await fetch('/api/videos/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          videoUrl,
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error(`Processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      const jobId = result.processingId;

      // Create new job
      const newJob: ProcessingJob = {
        id: jobId,
        videoUrl,
        videoTitle: metadata.title,
        videoThumbnail: metadata.thumbnail.high,
        status: 'processing',
        progress: 0,
        currentStep: 'validation',
        steps: [
          { id: 'validation', label: 'Video Validation', status: 'completed' },
          { id: 'transcript', label: 'Extract Transcript', status: 'pending' },
          { id: 'summary', label: 'Generate Summary', status: 'pending' },
          { id: 'flashcards', label: 'Create Flashcards', status: 'pending' },
          { id: 'quiz', label: 'Generate Quiz', status: 'pending' },
          { id: 'mindmap', label: 'Build Mind Map', status: 'pending' },
        ],
        startedAt: new Date().toISOString(),
      };

      setJobs(prev => [newJob, ...prev]);
      connectToJob(jobId);

      return jobId;
    } catch (error) {
      throw error;
    }
  }, [connectToJob]);

  const cancelProcessing = useCallback(async (jobId: string): Promise<void> => {
    try {
      await fetch(`/api/videos/process/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      setJobs(prev => prev.map(job =>
        job.id === jobId
          ? { ...job, status: 'cancelled' as const }
          : job
      ));

      disconnectFromJob(jobId);
    } catch (error) {
      console.error('Failed to cancel processing:', error);
      throw error;
    }
  }, [disconnectFromJob]);

  const retryProcessing = useCallback(async (jobId: string): Promise<void> => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    try {
      // Reset job status
      setJobs(prev => prev.map(j =>
        j.id === jobId
          ? {
              ...j,
              status: 'processing' as const,
              progress: 0,
              currentStep: 'transcript',
              error: undefined,
              steps: j.steps.map(step => ({
                ...step,
                status: step.id === 'validation' ? 'completed' as const : 'pending' as const,
                progress: undefined,
                error: undefined,
              })),
            }
          : j
      ));

      // Restart processing
      const response = await fetch(`/api/videos/process/${jobId}/retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Retry failed: ${response.statusText}`);
      }

      connectToJob(jobId);
    } catch (error) {
      console.error('Failed to retry processing:', error);
      setJobs(prev => prev.map(j =>
        j.id === jobId
          ? { ...j, status: 'error' as const, error: 'Failed to retry processing' }
          : j
      ));
      throw error;
    }
  }, [jobs, connectToJob]);

  const removeJob = useCallback((jobId: string) => {
    setJobs(prev => prev.filter(job => job.id !== jobId));
    disconnectFromJob(jobId);
  }, [disconnectFromJob]);

  const clearCompleted = useCallback(() => {
    setJobs(prev => prev.filter(job => job.status !== 'completed'));
  }, []);

  // Cleanup WebSocket connections on unmount
  useEffect(() => {
    return () => {
      wsConnections.forEach(ws => ws.close());
    };
  }, [wsConnections]);

  // Computed values
  const activeJobs = jobs.filter(job => job.status === 'processing');
  const completedJobs = jobs.filter(job => job.status === 'completed');
  const errorJobs = jobs.filter(job => job.status === 'error');
  const isProcessing = activeJobs.length > 0;

  return {
    jobs,
    activeJobs,
    completedJobs,
    errorJobs,
    startProcessing,
    cancelProcessing,
    retryProcessing,
    removeJob,
    clearCompleted,
    isProcessing,
  };
};