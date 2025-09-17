import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
} from '@mui/material';
import {
  Notifications,
  Email,
  PhoneAndroid,
  Schedule,
  TrendingUp,
  NewReleases,
  Save,
} from '@mui/icons-material';
import { type AppDispatch } from '../../store';
import { updateUserPreferences } from '../../store/slices/authSlice';
import { User } from '../../types/user';

interface NotificationSettingsProps {
  user: User;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ user }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [notifications, setNotifications] = useState({
    email: user.preferences.notifications.email,
    push: user.preferences.notifications.push,
    studyReminders: user.preferences.notifications.studyReminders,
    // Extended notification preferences
    weeklyProgress: true,
    newFeatures: true,
    learningTips: true,
    achievementUnlocked: true,
    streakReminders: true,
    quizResults: true,
    capsuleReady: true,
    socialUpdates: false,
    marketingEmails: false,
  });

  const handleNotificationChange = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setNotifications(prev => ({
      ...prev,
      [key]: event.target.checked,
    }));
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      dispatch(updateUserPreferences({
        notifications: {
          email: notifications.email,
          push: notifications.push,
          studyReminders: notifications.studyReminders,
        },
      }));

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const notificationCategories = [
    {
      title: 'Learning & Study',
      icon: <Schedule color="primary" />,
      items: [
        {
          key: 'studyReminders',
          label: 'Study Reminders',
          description: 'Daily reminders to maintain your learning streak',
          value: notifications.studyReminders,
        },
        {
          key: 'streakReminders',
          label: 'Streak Reminders',
          description: 'Notifications when your streak is at risk',
          value: notifications.streakReminders,
        },
        {
          key: 'capsuleReady',
          label: 'Capsule Processing Complete',
          description: 'When your video processing is finished',
          value: notifications.capsuleReady,
        },
        {
          key: 'learningTips',
          label: 'Learning Tips',
          description: 'Personalized tips to improve your learning',
          value: notifications.learningTips,
        },
      ],
    },
    {
      title: 'Progress & Achievements',
      icon: <TrendingUp color="success" />,
      items: [
        {
          key: 'weeklyProgress',
          label: 'Weekly Progress Reports',
          description: 'Summary of your learning progress each week',
          value: notifications.weeklyProgress,
        },
        {
          key: 'achievementUnlocked',
          label: 'Achievement Unlocked',
          description: 'When you earn new badges or achievements',
          value: notifications.achievementUnlocked,
        },
        {
          key: 'quizResults',
          label: 'Quiz Results',
          description: 'Detailed results and insights from your quizzes',
          value: notifications.quizResults,
        },
      ],
    },
    {
      title: 'Platform Updates',
      icon: <NewReleases color="info" />,
      items: [
        {
          key: 'newFeatures',
          label: 'New Features',
          description: 'Updates about new platform features and improvements',
          value: notifications.newFeatures,
        },
        {
          key: 'socialUpdates',
          label: 'Social Updates',
          description: 'Updates from friends and learning community',
          value: notifications.socialUpdates,
        },
      ],
    },
    {
      title: 'Marketing & Promotions',
      icon: <Email color="warning" />,
      items: [
        {
          key: 'marketingEmails',
          label: 'Marketing Emails',
          description: 'Promotional content and special offers',
          value: notifications.marketingEmails,
        },
      ],
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight="600">
          Notification Preferences
        </Typography>
        <Button
          startIcon={isLoading ? <CircularProgress size={16} /> : <Save />}
          onClick={handleSave}
          variant="contained"
          disabled={isLoading}
        >
          Save Changes
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Notification settings updated successfully!
        </Alert>
      )}

      {/* Delivery Methods */}
      <Typography variant="subtitle1" fontWeight="600" gutterBottom>
        Delivery Methods
      </Typography>
      <Paper sx={{ p: 2, mb: 4 }}>
        <List>
          <ListItem>
            <Email sx={{ mr: 2, color: 'primary.main' }} />
            <ListItemText
              primary="Email Notifications"
              secondary={`Delivered to ${user.email}`}
            />
            <ListItemSecondaryAction>
              <Switch
                checked={notifications.email}
                onChange={handleNotificationChange('email')}
                color="primary"
              />
            </ListItemSecondaryAction>
          </ListItem>
          <ListItem>
            <PhoneAndroid sx={{ mr: 2, color: 'secondary.main' }} />
            <ListItemText
              primary="Push Notifications"
              secondary="Browser and mobile app notifications"
            />
            <ListItemSecondaryAction>
              <Switch
                checked={notifications.push}
                onChange={handleNotificationChange('push')}
                color="primary"
              />
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Paper>

      {/* Notification Categories */}
      {notificationCategories.map((category, categoryIndex) => (
        <Box key={category.title} sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {category.icon}
            <Typography variant="subtitle1" fontWeight="600" sx={{ ml: 1 }}>
              {category.title}
            </Typography>
          </Box>
          <Paper sx={{ p: 2 }}>
            <List>
              {category.items.map((item, itemIndex) => (
                <ListItem key={item.key}>
                  <ListItemText
                    primary={item.label}
                    secondary={item.description}
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={item.value}
                      onChange={handleNotificationChange(item.key)}
                      color="primary"
                      disabled={
                        (!notifications.email && !notifications.push) ||
                        (item.key === 'studyReminders' && !notifications.email && !notifications.push)
                      }
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Box>
      ))}

      {/* Notification Schedule */}
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle1" fontWeight="600" gutterBottom>
        Notification Schedule
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Customize when you receive notifications to match your schedule.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Respect quiet hours (9 PM - 8 AM)"
          />
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Pause notifications on weekends"
          />
          <FormControlLabel
            control={<Switch />}
            label="Send digest instead of individual notifications"
          />
        </Box>
      </Paper>

      {/* Help Text */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Note:</strong> Some notifications are essential for account security and cannot be disabled.
          You can always update these preferences later from your profile settings.
        </Typography>
      </Alert>
    </Box>
  );
};