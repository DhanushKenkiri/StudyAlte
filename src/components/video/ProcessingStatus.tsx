import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Button,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Error,
  Cancel,
  Refresh,
  VideoLibrary,
  Subtitles,
  Psychology,
  Quiz,
  Notes,
  AccountTree,
} from '@mui/icons-material';

interface ProcessingJob {
  id: string;
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
  }>;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

interface ProcessingStatusProps {
  jobs: ProcessingJob[];
  onCancelJob?: (jobId: string) => void;
  onRetryJob?: (jobId: string) => void;
  onViewResult?: (jobId: string) => void;
  compact?: boolean;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  jobs,
  onCancelJob,
  onRetryJob,
  onViewResult,
  compact = false,
}) => {
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const getStepIcon = (stepId: string) => {
    switch (stepId) {
      case 'validation':
        return <VideoLibrary fontSize="small" />;
      case 'transcript':
        return <Subtitles fontSize="small" />;
      case 'summary':
        return <Notes fontSize="small" />;
      case 'flashcards':
        return <Psychology fontSize="small" />;
      case 'quiz':
        return <Quiz fontSize="small" />;
      case 'mindmap':
        return <AccountTree fontSize="small" />;
      default:
        return <VideoLibrary fontSize="small" />;
    }
  };

  const getStatusColor = (status: ProcessingJob['status']) => {
    switch (status) {
      case 'processing':
        return 'primary';
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: ProcessingJob['status']) => {
    switch (status) {
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (jobs.length === 0) {
    return null;
  }

  return (
    <Box>
      {jobs.map((job) => (
        <Card key={job.id} sx={{ mb: 2 }}>
          <CardContent sx={{ pb: compact ? 2 : 3 }}>
            {/* Job Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Box
                component="img"
                src={job.videoThumbnail}
                alt={job.videoTitle}
                sx={{
                  width: compact ? 60 : 80,
                  height: compact ? 34 : 45,
                  borderRadius: 1,
                  mr: 2,
                  objectFit: 'cover',
                }}
              />
              
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant={compact ? 'body2' : 'subtitle1'}
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {job.videoTitle}
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Chip
                    label={getStatusLabel(job.status)}
                    color={getStatusColor(job.status)}
                    size="small"
                  />
                  
                  <Typography variant="caption" color="text.secondary">
                    {job.status === 'processing' && `${job.currentStep} • ${formatDuration(job.startedAt)}`}
                    {job.status === 'completed' && `Completed in ${formatDuration(job.startedAt, job.completedAt)}`}
                    {job.status === 'error' && `Failed after ${formatDuration(job.startedAt)}`}
                    {job.status === 'cancelled' && `Cancelled after ${formatDuration(job.startedAt)}`}
                  </Typography>
                </Box>
              </Box>

              {/* Actions */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {job.status === 'processing' && onCancelJob && (
                  <IconButton
                    size="small"
                    onClick={() => onCancelJob(job.id)}
                    color="error"
                  >
                    <Cancel />
                  </IconButton>
                )}
                
                {job.status === 'error' && onRetryJob && (
                  <IconButton
                    size="small"
                    onClick={() => onRetryJob(job.id)}
                    color="primary"
                  >
                    <Refresh />
                  </IconButton>
                )}
                
                {job.status === 'completed' && onViewResult && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onViewResult(job.id)}
                  >
                    View
                  </Button>
                )}

                {!compact && (
                  <IconButton
                    size="small"
                    onClick={() => toggleJobExpansion(job.id)}
                  >
                    {expandedJobs.has(job.id) ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                )}
              </Box>
            </Box>

            {/* Progress Bar */}
            {job.status === 'processing' && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={job.progress}
                  sx={{ height: 6, borderRadius: 3 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {job.progress}% complete
                </Typography>
              </Box>
            )}

            {/* Error Message */}
            {job.status === 'error' && job.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {job.error}
              </Alert>
            )}

            {/* Detailed Steps */}
            {!compact && (
              <Collapse in={expandedJobs.has(job.id)}>
                <List dense>
                  {job.steps.map((step) => (
                    <ListItem key={step.id}>
                      <ListItemIcon>
                        {step.status === 'completed' ? (
                          <CheckCircle color="success" fontSize="small" />
                        ) : step.status === 'error' ? (
                          <Error color="error" fontSize="small" />
                        ) : step.status === 'processing' ? (
                          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                            <LinearProgress
                              variant={step.progress !== undefined ? 'determinate' : 'indeterminate'}
                              value={step.progress}
                              sx={{ width: 20, height: 20, borderRadius: '50%' }}
                            />
                          </Box>
                        ) : (
                          getStepIcon(step.id)
                        )}
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={step.label}
                        secondary={
                          step.status === 'processing' && step.progress !== undefined
                            ? `${step.progress}% complete`
                            : undefined
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};