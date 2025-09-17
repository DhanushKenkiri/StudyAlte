import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Alert,
} from '@mui/material';
import {
  Home as HomeIcon,
  VideoLibrary as VideoIcon,
} from '@mui/icons-material';
import { VideoProcessingInterface } from '../components/video/VideoProcessingInterface';

export const ProcessVideoPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialUrl = searchParams.get('url') || '';

  const handleProcessingComplete = (capsuleId: string) => {
    navigate(`/capsules/${capsuleId}`);
  };

  const handleProcessingError = (error: string) => {
    console.error('Processing error:', error);
    // Error is already handled by the VideoProcessingInterface component
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            color="inherit"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Home
          </Link>
          <Link
            color="inherit"
            href="/videos"
            onClick={(e) => {
              e.preventDefault();
              navigate('/videos');
            }}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <VideoIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Videos
          </Link>
          <Typography color="text.primary">Process Video</Typography>
        </Breadcrumbs>

        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Process YouTube Video
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Transform any YouTube video into comprehensive learning materials with AI-powered 
            summaries, flashcards, quizzes, and mind maps.
          </Typography>
        </Box>

        {/* Info Alert */}
        <Alert severity="info" sx={{ mb: 4 }}>
          <Typography variant="subtitle2" gutterBottom>
            What you'll get:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>AI-generated summary with key concepts</li>
            <li>Interactive flashcards for spaced repetition</li>
            <li>Quiz questions to test your understanding</li>
            <li>Visual mind map of concepts and relationships</li>
            <li>Searchable transcript with timestamps</li>
          </ul>
        </Alert>

        {/* Processing Interface */}
        <VideoProcessingInterface
          onProcessingComplete={handleProcessingComplete}
          onProcessingError={handleProcessingError}
          initialUrl={initialUrl}
        />
      </Box>
    </Container>
  );
};