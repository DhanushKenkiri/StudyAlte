import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Grid,
  useTheme,
  alpha,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  VideoLibrary as VideoIcon,
  Quiz as QuizIcon,
  Psychology as FlashcardIcon,
  Notes as NotesIcon,
  AccountTree as MindMapIcon,
  Upload as UploadIcon,
  Search as SearchIcon,
  Timeline as AnalyticsIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactElement;
  color: string;
  action: string;
  disabled?: boolean;
}

interface QuickActionsProps {
  onAction: (action: string) => void;
  loading?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onAction,
  loading = false,
}) => {
  const theme = useTheme();

  const quickActions: QuickAction[] = [
    {
      id: 'add-video',
      title: 'Add Video',
      description: 'Import a new YouTube video',
      icon: <VideoIcon />,
      color: theme.palette.primary.main,
      action: 'add-video',
    },
    {
      id: 'create-quiz',
      title: 'Create Quiz',
      description: 'Generate a new quiz',
      icon: <QuizIcon />,
      color: theme.palette.error.main,
      action: 'create-quiz',
    },
    {
      id: 'review-flashcards',
      title: 'Review Cards',
      description: 'Study your flashcards',
      icon: <FlashcardIcon />,
      color: theme.palette.warning.main,
      action: 'review-flashcards',
    },
    {
      id: 'view-notes',
      title: 'View Notes',
      description: 'Browse your notes',
      icon: <NotesIcon />,
      color: theme.palette.success.main,
      action: 'view-notes',
    },
    {
      id: 'create-mindmap',
      title: 'Mind Map',
      description: 'Create a mind map',
      icon: <MindMapIcon />,
      color: theme.palette.info.main,
      action: 'create-mindmap',
    },
    {
      id: 'search-content',
      title: 'Search',
      description: 'Find your content',
      icon: <SearchIcon />,
      color: theme.palette.secondary.main,
      action: 'search-content',
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            {[...Array(6)].map((_, index) => (
              <Grid item xs={6} key={index}>
                <Box
                  sx={{
                    height: 80,
                    bgcolor: 'action.hover',
                    borderRadius: 2,
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <AddIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" component="h2">
            Quick Actions
          </Typography>
        </Box>

        {/* Actions Grid */}
        <Grid container spacing={2}>
          {quickActions.map((action) => (
            <Grid item xs={6} key={action.id}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => onAction(action.action)}
                disabled={action.disabled}
                sx={{
                  height: 80,
                  flexDirection: 'column',
                  gap: 1,
                  borderColor: alpha(action.color, 0.3),
                  color: action.color,
                  backgroundColor: alpha(action.color, 0.02),
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: action.color,
                    backgroundColor: alpha(action.color, 0.08),
                    transform: 'translateY(-2px)',
                    boxShadow: `0 4px 12px ${alpha(action.color, 0.2)}`,
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 2,
                    backgroundColor: alpha(action.color, 0.1),
                    color: action.color,
                  }}
                >
                  {React.cloneElement(action.icon, { fontSize: 'small' })}
                </Box>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      lineHeight: 1.2,
                      display: 'block',
                    }}
                  >
                    {action.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.65rem',
                      opacity: 0.8,
                      lineHeight: 1,
                    }}
                  >
                    {action.description}
                  </Typography>
                </Box>
              </Button>
            </Grid>
          ))}
        </Grid>

        {/* Additional Actions */}
        <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              More actions
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                size="small"
                onClick={() => onAction('analytics')}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  },
                }}
              >
                <AnalyticsIcon fontSize="small" />
              </IconButton>
              
              <IconButton
                size="small"
                onClick={() => onAction('settings')}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  },
                }}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
              
              <IconButton
                size="small"
                onClick={() => onAction('upload')}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  },
                }}
              >
                <UploadIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};