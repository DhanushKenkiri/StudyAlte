import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Chip,
  Avatar,
  Divider,
  Alert,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  VideoLibrary as VideoIcon,
  Notes as NotesIcon,
  Psychology as FlashcardsIcon,
  Quiz as QuizIcon,
  AccountTree as MindMapIcon,
  Subtitles as TranscriptIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Visibility as ViewsIcon,
  AccessTime as TimeIcon,
  Person as AuthorIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

// Import tab components
import { CapsuleOverview } from './CapsuleOverview';
import { CapsuleSummary } from './CapsuleSummary';
import { CapsuleFlashcards } from './CapsuleFlashcards';
import { CapsuleQuiz } from './CapsuleQuiz';
import { CapsuleMindMap } from './CapsuleMindMap';
import { CapsuleTranscript } from './CapsuleTranscript';

interface LearningCapsuleData {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  videoThumbnail: string;
  videoDuration: number;
  channelTitle: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  isFavorite: boolean;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedStudyTime: number;
  completionRate: number;
  
  // Learning materials
  summary: {
    content: string;
    keyPoints: string[];
    sections: Array<{
      title: string;
      content: string;
      timestamp?: number;
    }>;
  };
  
  flashcards: Array<{
    id: string;
    front: string;
    back: string;
    difficulty: 'easy' | 'medium' | 'hard';
    tags: string[];
    lastReviewed?: string;
    nextReview?: string;
    reviewCount: number;
    correctCount: number;
  }>;
  
  quiz: {
    id: string;
    questions: Array<{
      id: string;
      type: 'multiple-choice' | 'true-false' | 'short-answer';
      question: string;
      options?: string[];
      correctAnswer: string | number;
      explanation: string;
      difficulty: 'easy' | 'medium' | 'hard';
      timestamp?: number;
    }>;
    timeLimit?: number;
    passingScore: number;
    attempts: Array<{
      id: string;
      score: number;
      completedAt: string;
      timeSpent: number;
    }>;
  };
  
  mindMap: {
    nodes: Array<{
      id: string;
      label: string;
      type: 'main' | 'concept' | 'detail';
      x: number;
      y: number;
      color?: string;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      label?: string;
    }>;
  };
  
  transcript: {
    segments: Array<{
      id: string;
      text: string;
      startTime: number;
      endTime: number;
      speaker?: string;
    }>;
    language: string;
    confidence: number;
  };
}

interface LearningCapsuleProps {
  capsuleId: string;
  onEdit?: (capsuleId: string) => void;
  onShare?: (capsuleId: string, method: string) => void;
  onExport?: (capsuleId: string, format: string) => void;
  onFavoriteToggle?: (capsuleId: string, isFavorite: boolean) => void;
  onStartStudy?: (capsuleId: string, material: string) => void;
}

export const LearningCapsule: React.FC<LearningCapsuleProps> = ({
  capsuleId,
  onEdit,
  onShare,
  onExport,
  onFavoriteToggle,
  onStartStudy,
}) => {
  const theme = useTheme();
  const [capsuleData, setCapsuleData] = useState<LearningCapsuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [shareMenuAnchor, setShareMenuAnchor] = useState<null | HTMLElement>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);

  const tabs = [
    { label: 'Overview', icon: <VideoIcon />, component: CapsuleOverview },
    { label: 'Summary', icon: <NotesIcon />, component: CapsuleSummary },
    { label: 'Flashcards', icon: <FlashcardsIcon />, component: CapsuleFlashcards },
    { label: 'Quiz', icon: <QuizIcon />, component: CapsuleQuiz },
    { label: 'Mind Map', icon: <MindMapIcon />, component: CapsuleMindMap },
    { label: 'Transcript', icon: <TranscriptIcon />, component: CapsuleTranscript },
  ];

  useEffect(() => {
    loadCapsuleData();
  }, [capsuleId]);

  const loadCapsuleData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/capsules/${capsuleId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load capsule: ${response.statusText}`);
      }

      const data = await response.json();
      setCapsuleData(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load capsule';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleFavoriteToggle = async () => {
    if (!capsuleData) return;

    const newFavoriteState = !capsuleData.isFavorite;
    
    // Optimistic update
    setCapsuleData(prev => prev ? { ...prev, isFavorite: newFavoriteState } : null);
    
    try {
      await fetch(`/api/capsules/${capsuleId}/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ isFavorite: newFavoriteState }),
      });
      
      onFavoriteToggle?.(capsuleId, newFavoriteState);
    } catch (error) {
      // Revert on error
      setCapsuleData(prev => prev ? { ...prev, isFavorite: !newFavoriteState } : null);
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleShare = (method: string) => {
    setShareMenuAnchor(null);
    onShare?.(capsuleId, method);
  };

  const handleExport = (format: string) => {
    setExportMenuAnchor(null);
    onExport?.(capsuleId, format);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return theme.palette.success.main;
      case 'intermediate':
        return theme.palette.warning.main;
      case 'advanced':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  if (loading) {
    return (
      <Box>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Skeleton variant="rectangular" width={200} height={112} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="80%" height={32} />
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="40%" height={20} />
              </Box>
            </Box>
            <Skeleton variant="rectangular" width="100%" height={48} />
          </CardContent>
        </Card>
        <Skeleton variant="rectangular" width="100%" height={400} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Failed to load learning capsule
        </Typography>
        <Typography variant="body2">
          {error}
        </Typography>
        <Button onClick={loadCapsuleData} sx={{ mt: 2 }}>
          Try Again
        </Button>
      </Alert>
    );
  }

  if (!capsuleData) {
    return (
      <Alert severity="warning">
        <Typography variant="h6">
          Learning capsule not found
        </Typography>
      </Alert>
    );
  }

  const ActiveTabComponent = tabs[activeTab].component;

  return (
    <Box>
      {/* Capsule Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            {/* Video Thumbnail */}
            <Box
              component="img"
              src={capsuleData.videoThumbnail}
              alt={capsuleData.title}
              sx={{
                width: 200,
                height: 112,
                borderRadius: 2,
                objectFit: 'cover',
              }}
            />
            
            {/* Capsule Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                <Typography
                  variant="h5"
                  component="h1"
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    flex: 1,
                    mr: 2,
                  }}
                >
                  {capsuleData.title}
                </Typography>
                
                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton
                    onClick={handleFavoriteToggle}
                    color={capsuleData.isFavorite ? 'error' : 'default'}
                  >
                    {capsuleData.isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                  </IconButton>
                  
                  <IconButton
                    onClick={(e) => setShareMenuAnchor(e.currentTarget)}
                  >
                    <ShareIcon />
                  </IconButton>
                  
                  <IconButton
                    onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                  >
                    <DownloadIcon />
                  </IconButton>
                  
                  <IconButton
                    onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>
              </Box>
              
              {/* Channel and Metadata */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AuthorIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {capsuleData.channelTitle}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TimeIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {formatDuration(capsuleData.videoDuration)}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ViewsIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {capsuleData.viewCount} views
                  </Typography>
                </Box>
              </Box>
              
              {/* Tags and Difficulty */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip
                  label={capsuleData.difficulty}
                  size="small"
                  sx={{
                    backgroundColor: alpha(getDifficultyColor(capsuleData.difficulty), 0.1),
                    color: getDifficultyColor(capsuleData.difficulty),
                    textTransform: 'capitalize',
                  }}
                />
                
                <Chip
                  label={`${capsuleData.estimatedStudyTime} min study`}
                  size="small"
                  variant="outlined"
                />
                
                <Chip
                  label={`${capsuleData.completionRate}% complete`}
                  size="small"
                  variant="outlined"
                />
                
                {capsuleData.tags.slice(0, 3).map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    size="small"
                    variant="outlined"
                  />
                ))}
                
                {capsuleData.tags.length > 3 && (
                  <Chip
                    label={`+${capsuleData.tags.length - 3} more`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
              
              {/* Description */}
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {capsuleData.description}
              </Typography>
            </Box>
          </Box>
          
          {/* Last Updated */}
          <Typography variant="caption" color="text.secondary">
            Created {formatDistanceToNow(new Date(capsuleData.createdAt), { addSuffix: true })}
            {capsuleData.updatedAt !== capsuleData.createdAt && (
              <> • Updated {formatDistanceToNow(new Date(capsuleData.updatedAt), { addSuffix: true })}</>
            )}
          </Typography>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minHeight: 64,
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
              },
            }}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                icon={tab.icon}
                label={tab.label}
                iconPosition="start"
                sx={{ gap: 1 }}
              />
            ))}
          </Tabs>
        </Box>
        
        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <ActiveTabComponent
              capsuleData={capsuleData}
              onStartStudy={onStartStudy}
            />
          </motion.div>
        </AnimatePresence>
      </Card>

      {/* Share Menu */}
      <Menu
        anchorEl={shareMenuAnchor}
        open={Boolean(shareMenuAnchor)}
        onClose={() => setShareMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleShare('link')}>
          Copy Link
        </MenuItem>
        <MenuItem onClick={() => handleShare('email')}>
          Share via Email
        </MenuItem>
        <MenuItem onClick={() => handleShare('social')}>
          Share on Social Media
        </MenuItem>
      </Menu>

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleExport('pdf')}>
          Export as PDF
        </MenuItem>
        <MenuItem onClick={() => handleExport('docx')}>
          Export as Word Document
        </MenuItem>
        <MenuItem onClick={() => handleExport('json')}>
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => handleExport('anki')}>
          Export to Anki
        </MenuItem>
      </Menu>

      {/* More Menu */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={() => setMoreMenuAnchor(null)}
      >
        <MenuItem onClick={() => { setMoreMenuAnchor(null); onEdit?.(capsuleId); }}>
          <EditIcon sx={{ mr: 1 }} />
          Edit Capsule
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => setMoreMenuAnchor(null)}>
          View Original Video
        </MenuItem>
        <MenuItem onClick={() => setMoreMenuAnchor(null)}>
          Duplicate Capsule
        </MenuItem>
        <MenuItem onClick={() => setMoreMenuAnchor(null)} sx={{ color: 'error.main' }}>
          Delete Capsule
        </MenuItem>
      </Menu>
    </Box>
  );
};