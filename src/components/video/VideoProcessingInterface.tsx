import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Divider,
} from '@mui/material';
import {
  PlayArrow,
  CheckCircle,
  Error,
  Warning,
  Refresh,
  Cancel,
  ExpandMore,
  ExpandLess,
  VideoLibrary,
  Subtitles,
  Psychology,
  Quiz,
  Notes,
  AccountTree,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoUrlInput } from './VideoUrlInput';
import { YouTubeVideoMetadata } from '../../services/youtube/youtubeService';
import { useVideoProcessing } from '../../hooks/useVideoProcessing';

interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactElement;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
  result?: any;
}

interface VideoProcessingInterfaceProps {
  onProcessingComplete?: (capsuleId: string) => void;
  onProcessingError?: (error: string) => void;
  initialUrl?: string;
}

export const VideoProcessingInterface: React.FC<VideoProcessingInterfaceProps> = ({
  onProcessingComplete,
  onProcessingError,
  initialUrl = '',
}) => {
  const [videoMetadata, setVideoMetadata] = useState<YouTubeVideoMetadata | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  const {
    jobs,
    activeJobs,
    startProcessing,
    cancelProcessing,
    retryProcessing,
    isProcessing,
  } = useVideoProcessing();

  // Get current job
  const currentJob = currentJobId ? jobs.find(job => job.id === currentJobId) : null;
  
  const processingSteps: ProcessingStep[] = [
    {
      id: 'validation',
      label: 'Video Validation',
      description: 'Validating YouTube URL and checking video availability',
      icon: <VideoLibrary />,
      status: 'completed', // Always completed when we reach this interface
    },
    {
      id: 'transcript',
      label: 'Extract Transcript',
      description: 'Extracting video transcript and captions',
      icon: <Subtitles />,
      status: currentJob?.steps.find(s => s.id === 'transcript')?.status || 'pending',
      progress: currentJob?.steps.find(s => s.id === 'transcript')?.progress,
      error: currentJob?.steps.find(s => s.id === 'transcript')?.error,
    },
    {
      id: 'summary',
      label: 'Generate Summary',
      description: 'Creating AI-powered content summary',
      icon: <Notes />,
      status: currentJob?.steps.find(s => s.id === 'summary')?.status || 'pending',
      progress: currentJob?.steps.find(s => s.id === 'summary')?.progress,
      error: currentJob?.steps.find(s => s.id === 'summary')?.error,
    },
    {
      id: 'flashcards',
      label: 'Create Flashcards',
      description: 'Generating interactive flashcards',
      icon: <Psychology />,
      status: currentJob?.steps.find(s => s.id === 'flashcards')?.status || 'pending',
      progress: currentJob?.steps.find(s => s.id === 'flashcards')?.progress,
      error: currentJob?.steps.find(s => s.id === 'flashcards')?.error,
    },
    {
      id: 'quiz',
      label: 'Generate Quiz',
      description: 'Creating quiz questions and answers',
      icon: <Quiz />,
      status: currentJob?.steps.find(s => s.id === 'quiz')?.status || 'pending',
      progress: currentJob?.steps.find(s => s.id === 'quiz')?.progress,
      error: currentJob?.steps.find(s => s.id === 'quiz')?.error,
    },
    {
      id: 'mindmap',
      label: 'Build Mind Map',
      description: 'Constructing visual concept map',
      icon: <AccountTree />,
      status: currentJob?.steps.find(s => s.id === 'mindmap')?.status || 'pending',
      progress: currentJob?.steps.find(s => s.id === 'mindmap')?.progress,
      error: currentJob?.steps.find(s => s.id === 'mindmap')?.error,
    },
  ];

  // Handle job completion
  useEffect(() => {
    if (currentJob?.status === 'completed' && currentJob.capsuleId) {
      onProcessingComplete?.(currentJob.capsuleId);
    } else if (currentJob?.status === 'error' && currentJob.error) {
      onProcessingError?.(currentJob.error);
    }
  }, [currentJob?.status, currentJob?.capsuleId, currentJob?.error, onProcessingComplete, onProcessingError]);

  const handleVideoValidated = (metadata: YouTubeVideoMetadata) => {
    setVideoMetadata(metadata);
  };

  const handleValidationError = (error: string) => {
    onProcessingError?.(error);
  };

  const handleStartProcessing = async () => {
    if (!videoMetadata) return;

    try {
      const jobId = await startProcessing(videoMetadata.url, videoMetadata);
      setCurrentJobId(jobId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start processing';
      onProcessingError?.(errorMessage);
    }
  };

  const handleCancelProcessing = async () => {
    if (!currentJobId) return;

    try {
      await cancelProcessing(currentJobId);
      setCurrentJobId(null);
    } catch (error) {
      console.error('Failed to cancel processing:', error);
    }
    
    setShowCancelDialog(false);
  };

  const handleRetryProcessing = async () => {
    if (!currentJobId) return;

    try {
      await retryProcessing(currentJobId);
    } catch (error) {
      console.error('Failed to retry processing:', error);
    }
  };

  const resetInterface = () => {
    setVideoMetadata(null);
    setCurrentJobId(null);
  };

  const getStepIcon = (step: ProcessingStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'processing':
        return <LinearProgress sx={{ width: 20, height: 20, borderRadius: '50%' }} />;
      default:
        return step.icon;
    }
  };

  const getOverallProgress = () => {
    return currentJob?.progress || 0;
  };

  const getActiveStep = () => {
    if (!currentJob) return 0;
    return processingSteps.findIndex(step => step.status === 'processing') || 0;
  };

  const hasErrors = currentJob?.status === 'error' || processingSteps.some(step => step.status === 'error');
  const isCompleted = currentJob?.status === 'completed';
  const isCurrentlyProcessing = currentJob?.status === 'processing';

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            Process YouTube Video
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Transform any YouTube video into interactive learning materials including summaries, 
            flashcards, quizzes, and mind maps.
          </Typography>

          {/* Video Input Section */}
          <Box sx={{ mb: 4 }}>
            <VideoUrlInput
              onVideoValidated={handleVideoValidated}
              onValidationError={handleValidationError}
              disabled={isProcessing}
              initialUrl={initialUrl}
            />
          </Box>

          {/* Processing Controls */}
          {videoMetadata && !isCurrentlyProcessing && !isCompleted && (
            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrow />}
                onClick={handleStartProcessing}
                disabled={!videoMetadata}
              >
                Start Processing
              </Button>
              <Button
                variant="outlined"
                onClick={resetInterface}
              >
                Reset
              </Button>
            </Box>
          )}

          {/* Processing Progress */}
          {(isCurrentlyProcessing || isCompleted || hasErrors) && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">
                  Processing Progress
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {isCurrentlyProcessing && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<Cancel />}
                      onClick={() => setShowCancelDialog(true)}
                    >
                      Cancel
                    </Button>
                  )}
                  {hasErrors && !isCurrentlyProcessing && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Refresh />}
                      onClick={handleRetryProcessing}
                    >
                      Retry
                    </Button>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    {showDetails ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>
              </Box>

              {/* Overall Progress Bar */}
              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={getOverallProgress()}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  {Math.round(getOverallProgress())}% complete
                </Typography>
              </Box>

              {/* Status Chips */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {isCurrentlyProcessing && (
                  <Chip
                    label="Processing..."
                    color="primary"
                    size="small"
                    icon={<LinearProgress sx={{ width: 16, height: 16 }} />}
                  />
                )}
                {isCompleted && (
                  <Chip
                    label="Completed"
                    color="success"
                    size="small"
                    icon={<CheckCircle />}
                  />
                )}
                {hasErrors && (
                  <Chip
                    label="Errors occurred"
                    color="error"
                    size="small"
                    icon={<Error />}
                  />
                )}
              </Box>

              {/* Detailed Steps */}
              <Collapse in={showDetails}>
                <Stepper activeStep={getActiveStep()} orientation="vertical">
                  {processingSteps.map((step, index) => (
                    <Step key={step.id} completed={step.status === 'completed'}>
                      <StepLabel
                        error={step.status === 'error'}
                        icon={getStepIcon(step)}
                      >
                        <Typography variant="subtitle2">
                          {step.label}
                        </Typography>
                      </StepLabel>
                      <StepContent>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {step.description}
                        </Typography>
                        
                        {/* Step Progress */}
                        {step.status === 'processing' && step.progress !== undefined && (
                          <Box sx={{ mb: 2 }}>
                            <LinearProgress
                              variant="determinate"
                              value={step.progress}
                              sx={{ mb: 1 }}
                            />
                            <Typography variant="caption">
                              {step.progress}% complete
                            </Typography>
                          </Box>
                        )}

                        {/* Step Error */}
                        {step.status === 'error' && step.error && (
                          <Alert severity="error" sx={{ mb: 2 }}>
                            {step.error}
                          </Alert>
                        )}

                        {/* Step Result */}
                        {step.status === 'completed' && step.result && (
                          <Alert severity="success" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                              {step.id === 'validation' && 'Video validated successfully'}
                              {step.id === 'transcript' && `Transcript extracted (${step.result.wordCount} words)`}
                              {step.id === 'summary' && `Summary generated (${step.result.sections} sections)`}
                              {step.id === 'flashcards' && `${step.result.count} flashcards created`}
                              {step.id === 'quiz' && `${step.result.questions} quiz questions generated`}
                              {step.id === 'mindmap' && `Mind map created with ${step.result.nodes} concepts`}
                            </Typography>
                          </Alert>
                        )}
                      </StepContent>
                    </Step>
                  ))}
                </Stepper>
              </Collapse>
            </Box>
          )}

          {/* Completion Actions */}
          {isCompleted && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Processing Complete!
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Your learning capsule has been created successfully. You can now start studying!
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  onClick={() => onProcessingComplete?.(currentJob?.capsuleId!)}
                >
                  View Learning Capsule
                </Button>
                <Button
                  variant="outlined"
                  onClick={resetInterface}
                >
                  Process Another Video
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
      >
        <DialogTitle>Cancel Processing?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to cancel the video processing? This will stop all current operations 
            and you'll need to start over.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCancelDialog(false)}>
            Continue Processing
          </Button>
          <Button onClick={handleCancelProcessing} color="error">
            Cancel Processing
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};