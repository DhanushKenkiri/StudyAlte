import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
} from '@mui/material';
import {
  PlayCircleOutline,
  Quiz,
  Psychology,
  Analytics,
  ArrowForward,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { type RootState } from '../store';

const features = [
  {
    icon: <PlayCircleOutline sx={{ fontSize: 48, color: 'primary.main' }} />,
    title: 'Video Processing',
    description: 'Transform YouTube videos into structured learning materials with AI-powered analysis.',
    benefits: ['Automatic transcription', 'Key concept extraction', 'Chapter generation'],
  },
  {
    icon: <Quiz sx={{ fontSize: 48, color: 'secondary.main' }} />,
    title: 'Interactive Learning',
    description: 'Generate flashcards, quizzes, and mind maps automatically from video content.',
    benefits: ['Smart flashcards', 'Adaptive quizzes', 'Visual mind maps'],
  },
  {
    icon: <Psychology sx={{ fontSize: 48, color: 'success.main' }} />,
    title: 'AI Tutor',
    description: 'Get personalized help and explanations from an AI tutor that knows your content.',
    benefits: ['24/7 availability', 'Contextual answers', 'Learning guidance'],
  },
  {
    icon: <Analytics sx={{ fontSize: 48, color: 'warning.main' }} />,
    title: 'Progress Tracking',
    description: 'Monitor your learning journey with detailed analytics and insights.',
    benefits: ['Study streaks', 'Performance metrics', 'Goal tracking'],
  },
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/auth/register');
    }
  };

  const handleSignIn = () => {
    navigate('/auth/login');
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 8,
        }}
      >
        <Container maxWidth="lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={6}>
                <Typography variant="h2" component="h1" gutterBottom fontWeight="bold">
                  Transform YouTube Videos into
                  <Typography component="span" sx={{ color: 'yellow', ml: 1 }}>
                    Interactive Learning
                  </Typography>
                </Typography>
                <Typography variant="h5" sx={{ mb: 4, opacity: 0.9 }}>
                  Harness the power of AI to create flashcards, quizzes, mind maps, and get personalized tutoring from any YouTube video.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleGetStarted}
                    sx={{
                      bgcolor: 'white',
                      color: 'primary.main',
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: 'grey.100',
                      },
                    }}
                    endIcon={<ArrowForward />}
                  >
                    {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
                  </Button>
                  {!isAuthenticated && (
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={handleSignIn}
                      sx={{
                        borderColor: 'white',
                        color: 'white',
                        px: 4,
                        py: 1.5,
                        fontSize: '1.1rem',
                        '&:hover': {
                          borderColor: 'white',
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                        },
                      }}
                    >
                      Sign In
                    </Button>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                >
                  <Box
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 3,
                      p: 3,
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      🎯 Perfect for:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {['Students', 'Professionals', 'Lifelong Learners', 'Educators'].map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          sx={{
                            bgcolor: 'rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            fontWeight: 500,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </motion.div>
              </Grid>
            </Grid>
          </motion.div>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <Typography variant="h3" component="h2" textAlign="center" gutterBottom fontWeight="bold">
            Powerful Features for Enhanced Learning
          </Typography>
          <Typography variant="h6" textAlign="center" color="text.secondary" sx={{ mb: 6 }}>
            Everything you need to turn passive video watching into active learning
          </Typography>
        </motion.div>

        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} md={6} key={feature.title}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1, duration: 0.6 }}
              >
                <Card
                  sx={{
                    height: '100%',
                    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      {feature.icon}
                      <Typography variant="h5" component="h3" sx={{ ml: 2, fontWeight: 600 }}>
                        {feature.title}
                      </Typography>
                    </Box>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                      {feature.description}
                    </Typography>
                    <Box>
                      {feature.benefits.map((benefit) => (
                        <Typography
                          key={benefit}
                          variant="body2"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            mb: 1,
                            color: 'text.secondary',
                          }}
                        >
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              mr: 2,
                            }}
                          />
                          {benefit}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA Section */}
      <Box sx={{ bgcolor: 'grey.50', py: 8 }}>
        <Container maxWidth="md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h3" component="h2" gutterBottom fontWeight="bold">
                Ready to Supercharge Your Learning?
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
                Join thousands of learners who are already transforming their YouTube experience
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleGetStarted}
                sx={{
                  px: 6,
                  py: 2,
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  borderRadius: 3,
                }}
                endIcon={<ArrowForward />}
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Start Learning Today'}
              </Button>
              {!isAuthenticated && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No credit card required • Free forever plan available
                </Typography>
              )}
            </Box>
          </motion.div>
        </Container>
      </Box>
    </Box>
  );
};