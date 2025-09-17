import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box,
  TextField,
  Button,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Save, Edit } from '@mui/icons-material';
import { type AppDispatch } from '../../store';
import { updateProfile } from '../../store/slices/authSlice';
import { User } from '../../types/user';

interface ProfileSettingsProps {
  user: User;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: user.name,
    bio: user.profile.bio || '',
    location: user.profile.location || '',
    website: user.profile.website || '',
    theme: user.preferences.theme,
    language: user.preferences.language,
    profileVisibility: user.preferences.privacy.profileVisibility,
    shareProgress: user.preferences.privacy.shareProgress,
    difficultyLevel: user.preferences.learning.difficultyLevel,
    dailyMinutes: user.preferences.learning.studyGoals.dailyMinutes,
    weeklyGoal: user.preferences.learning.studyGoals.weeklyGoal,
  });

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSelectChange = (field: string) => (event: any) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await dispatch(updateProfile({
        name: formData.name,
        profile: {
          bio: formData.bio || null,
          location: formData.location || null,
          website: formData.website || null,
        },
        preferences: {
          theme: formData.theme,
          language: formData.language,
          privacy: {
            profileVisibility: formData.profileVisibility,
            shareProgress: formData.shareProgress,
          },
          learning: {
            difficultyLevel: formData.difficultyLevel,
            studyGoals: {
              dailyMinutes: formData.dailyMinutes,
              weeklyGoal: formData.weeklyGoal,
            },
          },
        },
      })).unwrap();

      setSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user.name,
      bio: user.profile.bio || '',
      location: user.profile.location || '',
      website: user.profile.website || '',
      theme: user.preferences.theme,
      language: user.preferences.language,
      profileVisibility: user.preferences.privacy.profileVisibility,
      shareProgress: user.preferences.privacy.shareProgress,
      difficultyLevel: user.preferences.learning.difficultyLevel,
      dailyMinutes: user.preferences.learning.studyGoals.dailyMinutes,
      weeklyGoal: user.preferences.learning.studyGoals.weeklyGoal,
    });
    setIsEditing(false);
    setError(null);
    setSuccess(false);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight="600">
          Profile Information
        </Typography>
        {!isEditing ? (
          <Button
            startIcon={<Edit />}
            onClick={() => setIsEditing(true)}
            variant="outlined"
          >
            Edit Profile
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              startIcon={isLoading ? <CircularProgress size={16} /> : <Save />}
              onClick={handleSave}
              variant="contained"
              disabled={isLoading}
            >
              Save Changes
            </Button>
          </Box>
        )}
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Profile updated successfully!
        </Alert>
      )}

      {/* Basic Information */}
      <Typography variant="subtitle1" fontWeight="600" gutterBottom>
        Basic Information
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Full Name"
            value={formData.name}
            onChange={handleInputChange('name')}
            disabled={!isEditing}
            required
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Email"
            value={user.email}
            disabled
            helperText="Email cannot be changed here. Use security settings."
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Bio"
            value={formData.bio}
            onChange={handleInputChange('bio')}
            disabled={!isEditing}
            multiline
            rows={3}
            placeholder="Tell us about yourself..."
            inputProps={{ maxLength: 500 }}
            helperText={`${formData.bio.length}/500 characters`}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Location"
            value={formData.location}
            onChange={handleInputChange('location')}
            disabled={!isEditing}
            placeholder="City, Country"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Website"
            value={formData.website}
            onChange={handleInputChange('website')}
            disabled={!isEditing}
            placeholder="https://your-website.com"
            type="url"
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Appearance Settings */}
      <Typography variant="subtitle1" fontWeight="600" gutterBottom>
        Appearance
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth disabled={!isEditing}>
            <InputLabel>Theme</InputLabel>
            <Select
              value={formData.theme}
              onChange={handleSelectChange('theme')}
              label="Theme"
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="auto">Auto</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth disabled={!isEditing}>
            <InputLabel>Language</InputLabel>
            <Select
              value={formData.language}
              onChange={handleSelectChange('language')}
              label="Language"
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="es">Spanish</MenuItem>
              <MenuItem value="fr">French</MenuItem>
              <MenuItem value="de">German</MenuItem>
              <MenuItem value="zh">Chinese</MenuItem>
              <MenuItem value="ja">Japanese</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Privacy Settings */}
      <Typography variant="subtitle1" fontWeight="600" gutterBottom>
        Privacy
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth disabled={!isEditing}>
            <InputLabel>Profile Visibility</InputLabel>
            <Select
              value={formData.profileVisibility}
              onChange={handleSelectChange('profileVisibility')}
              label="Profile Visibility"
            >
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="private">Private</MenuItem>
              <MenuItem value="friends">Friends Only</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.shareProgress}
                onChange={handleInputChange('shareProgress')}
                disabled={!isEditing}
              />
            }
            label="Share Learning Progress"
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Learning Preferences */}
      <Typography variant="subtitle1" fontWeight="600" gutterBottom>
        Learning Preferences
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth disabled={!isEditing}>
            <InputLabel>Difficulty Level</InputLabel>
            <Select
              value={formData.difficultyLevel}
              onChange={handleSelectChange('difficultyLevel')}
              label="Difficulty Level"
            >
              <MenuItem value="beginner">Beginner</MenuItem>
              <MenuItem value="intermediate">Intermediate</MenuItem>
              <MenuItem value="advanced">Advanced</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Daily Study Goal (minutes)"
            type="number"
            value={formData.dailyMinutes}
            onChange={handleInputChange('dailyMinutes')}
            disabled={!isEditing}
            inputProps={{ min: 5, max: 480 }}
            helperText="5-480 minutes per day"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Weekly Study Goal (sessions)"
            type="number"
            value={formData.weeklyGoal}
            onChange={handleInputChange('weeklyGoal')}
            disabled={!isEditing}
            inputProps={{ min: 1, max: 21 }}
            helperText="1-21 sessions per week"
          />
        </Grid>
      </Grid>
    </Box>
  );
};