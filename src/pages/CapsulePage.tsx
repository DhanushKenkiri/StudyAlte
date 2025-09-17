import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Breadcrumbs,
  Link,
  Typography,
  Alert,
} from '@mui/material';
import {
  Home as HomeIcon,
  VideoLibrary as VideoIcon,
  School as CapsuleIcon,
} from '@mui/icons-material';
import { LearningCapsule } from '../components/capsule';

export const CapsulePage: React.FC = () => {
  const { capsuleId } = useParams<{ capsuleId: string }>();
  const navigate = useNavigate();

  if (!capsuleId) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">
            <Typography variant="h6">
              Invalid capsule ID
            </Typography>
            <Typography variant="body2">
              The capsule ID is missing or invalid.
            </Typography>
          </Alert>
        </Box>
      </Container>
    );
  }

  const handleEdit = (capsuleId: string) => {
    navigate(`/capsules/${capsuleId}/edit`);
  };

  const handleShare = (capsuleId: string, method: string) => {
    switch (method) {
      case 'link':
        const url = `${window.location.origin}/capsules/${capsuleId}`;
        navigator.clipboard.writeText(url);
        // You could add a toast notification here
        break;
      case 'email':
        const subject = encodeURIComponent('Check out this learning capsule');
        const body = encodeURIComponent(`I found this interesting learning capsule: ${window.location.href}`);
        window.open(`mailto:?subject=${subject}&body=${body}`);
        break;
      case 'social':
        // Implement social sharing
        break;
    }
  };

  const handleExport = (capsuleId: string, format: string) => {
    // This would typically trigger a download
    console.log(`Exporting capsule ${capsuleId} as ${format}`);
    // You could implement actual export functionality here
  };

  const handleFavoriteToggle = (capsuleId: string, isFavorite: boolean) => {
    console.log(`Capsule ${capsuleId} favorite status: ${isFavorite}`);
    // This would typically update the favorite status in the backend
  };

  const handleStartStudy = (capsuleId: string, material: string) => {
    switch (material) {
      case 'summary':
        // Navigate to summary study mode or scroll to summary tab
        break;
      case 'flashcards':
      case 'flashcards-all':
      case 'flashcards-due':
      case 'flashcards-new':
      case 'flashcards-difficult':
        navigate(`/study/flashcards/${capsuleId}?mode=${material.replace('flashcards-', '')}`);
        break;
      case 'quiz':
        navigate(`/study/quiz/${capsuleId}`);
        break;
      case 'mindmap':
        navigate(`/study/mindmap/${capsuleId}`);
        break;
      case 'notes':
        navigate(`/notes/create?capsule=${capsuleId}`);
        break;
      default:
        console.log(`Starting study for ${material} in capsule ${capsuleId}`);
    }
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
            href="/capsules"
            onClick={(e) => {
              e.preventDefault();
              navigate('/capsules');
            }}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <CapsuleIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Learning Capsules
          </Link>
          <Typography color="text.primary">Capsule Details</Typography>
        </Breadcrumbs>

        {/* Learning Capsule */}
        <LearningCapsule
          capsuleId={capsuleId}
          onEdit={handleEdit}
          onShare={handleShare}
          onExport={handleExport}
          onFavoriteToggle={handleFavoriteToggle}
          onStartStudy={handleStartStudy}
        />
      </Box>
    </Container>
  );
};