import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Avatar,
  Button,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Edit,
  PhotoCamera,
  Settings,
  Person,
  Security,
  Notifications,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { type RootState, type AppDispatch } from '../../store';
import { ProfileSettings } from './ProfileSettings';
import { SecuritySettings } from './SecuritySettings';
import { NotificationSettings } from './NotificationSettings';
import { AvatarUpload } from './AvatarUpload';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const ProfilePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const [activeTab, setActiveTab] = useState(0);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h6" color="text.secondary" textAlign="center">
          Please sign in to view your profile.
        </Typography>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Paper sx={{ p: 4, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Box sx={{ position: 'relative', mr: 3 }}>
                <Avatar
                  src={user.profile.avatar || undefined}
                  sx={{
                    width: 100,
                    height: 100,
                    fontSize: '2rem',
                    bgcolor: 'primary.main',
                  }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
                <IconButton
                  sx={{
                    position: 'absolute',
                    bottom: -8,
                    right: -8,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  }}
                  size="small"
                  onClick={() => setShowAvatarUpload(true)}
                >
                  <PhotoCamera fontSize="small" />
                </IconButton>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                  {user.name}
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  {user.email}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={`${user.subscription.tier} Plan`}
                    color="primary"
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                  <Chip
                    label={user.emailVerified ? 'Verified' : 'Unverified'}
                    color={user.emailVerified ? 'success' : 'warning'}
                    size="small"
                  />
                  {user.onboardingCompleted && (
                    <Chip
                      label="Onboarding Complete"
                      color="info"
                      size="small"
                    />
                  )}
                </Box>
              </Box>
            </Box>

            {user.profile.bio && (
              <Typography variant="body1" sx={{ mb: 2 }}>
                {user.profile.bio}
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', color: 'text.secondary' }}>
              {user.profile.location && (
                <Typography variant="body2">
                  📍 {user.profile.location}
                </Typography>
              )}
              {user.profile.website && (
                <Typography variant="body2">
                  🌐 <a href={user.profile.website} target="_blank" rel="noopener noreferrer">
                    {user.profile.website}
                  </a>
                </Typography>
              )}
              <Typography variant="body2">
                📅 Joined {new Date(user.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
          </Paper>
        </motion.div>

        {/* Profile Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab
                icon={<Person />}
                label="Profile"
                id="profile-tab-0"
                aria-controls="profile-tabpanel-0"
              />
              <Tab
                icon={<Security />}
                label="Security"
                id="profile-tab-1"
                aria-controls="profile-tabpanel-1"
              />
              <Tab
                icon={<Notifications />}
                label="Notifications"
                id="profile-tab-2"
                aria-controls="profile-tabpanel-2"
              />
            </Tabs>

            <TabPanel value={activeTab} index={0}>
              <ProfileSettings user={user} />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <SecuritySettings user={user} />
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
              <NotificationSettings user={user} />
            </TabPanel>
          </Paper>
        </motion.div>

        {/* Avatar Upload Modal */}
        <AvatarUpload
          open={showAvatarUpload}
          onClose={() => setShowAvatarUpload(false)}
          currentAvatar={user.profile.avatar}
          userId={user.id}
        />
      </Container>
    </Box>
  );
};