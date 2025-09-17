import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box,
  TextField,
  Button,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
} from '@mui/material';
import {
  Lock,
  Email,
  Delete,
  Security,
  Smartphone,
  Computer,
  Warning,
} from '@mui/icons-material';
import { type AppDispatch } from '../../store';
import { updatePassword, deleteAccount } from '../../store/slices/authSlice';
import { User } from '../../types/user';

interface SecuritySettingsProps {
  user: User;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ user }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Delete account confirmation
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const handlePasswordChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData(prev => ({ ...prev, [field]: event.target.value }));
    setError(null);
    setSuccess(null);
  };

  const handleUpdatePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await dispatch(updatePassword({
        oldPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })).unwrap();

      setSuccess('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await dispatch(deleteAccount()).unwrap();
      // User will be redirected after successful deletion
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      setIsLoading(false);
    }
  };

  // Mock data for demonstration
  const loginSessions = [
    {
      id: '1',
      device: 'Chrome on Windows',
      location: 'New York, US',
      lastActive: '2 minutes ago',
      current: true,
    },
    {
      id: '2',
      device: 'Safari on iPhone',
      location: 'New York, US',
      lastActive: '1 hour ago',
      current: false,
    },
    {
      id: '3',
      device: 'Firefox on macOS',
      location: 'San Francisco, US',
      lastActive: '2 days ago',
      current: false,
    },
  ];

  return (
    <Box>
      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {/* Account Security Overview */}
      <Typography variant="h6" fontWeight="600" gutterBottom>
        Account Security
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Email sx={{ mr: 1, color: user.emailVerified ? 'success.main' : 'warning.main' }} />
              <Typography variant="subtitle2">Email Verification</Typography>
            </Box>
            <Chip
              label={user.emailVerified ? 'Verified' : 'Unverified'}
              color={user.emailVerified ? 'success' : 'warning'}
              size="small"
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Lock sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="subtitle2">Password</Typography>
            </Box>
            <Chip label="Strong" color="success" size="small" />
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Security sx={{ mr: 1, color: 'info.main' }} />
              <Typography variant="subtitle2">Two-Factor Auth</Typography>
            </Box>
            <Chip label="Disabled" color="default" size="small" />
          </Box>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Change Password */}
      <Typography variant="h6" fontWeight="600" gutterBottom>
        Change Password
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Current Password"
            type="password"
            value={passwordData.currentPassword}
            onChange={handlePasswordChange('currentPassword')}
            autoComplete="current-password"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={passwordData.newPassword}
            onChange={handlePasswordChange('newPassword')}
            autoComplete="new-password"
            helperText="Must be at least 8 characters with uppercase, lowercase, numbers, and symbols"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Confirm New Password"
            type="password"
            value={passwordData.confirmPassword}
            onChange={handlePasswordChange('confirmPassword')}
            autoComplete="new-password"
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            onClick={handleUpdatePassword}
            disabled={
              isLoading ||
              !passwordData.currentPassword ||
              !passwordData.newPassword ||
              !passwordData.confirmPassword
            }
            startIcon={isLoading ? <CircularProgress size={16} /> : <Lock />}
          >
            Update Password
          </Button>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Active Sessions */}
      <Typography variant="h6" fontWeight="600" gutterBottom>
        Active Sessions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        These are the devices that are currently signed in to your account.
      </Typography>
      <List sx={{ mb: 4 }}>
        {loginSessions.map((session, index) => (
          <ListItem
            key={session.id}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              mb: 1,
              bgcolor: session.current ? 'action.selected' : 'background.paper',
            }}
          >
            <ListItemIcon>
              {session.device.includes('iPhone') ? <Smartphone /> : <Computer />}
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {session.device}
                  {session.current && (
                    <Chip label="Current" color="primary" size="small" />
                  )}
                </Box>
              }
              secondary={`${session.location} • ${session.lastActive}`}
            />
            {!session.current && (
              <Button size="small" color="error">
                Revoke
              </Button>
            )}
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 3 }} />

      {/* Danger Zone */}
      <Typography variant="h6" fontWeight="600" color="error" gutterBottom>
        Danger Zone
      </Typography>
      <Box sx={{ p: 3, border: 1, borderColor: 'error.main', borderRadius: 1, bgcolor: 'error.50' }}>
        <Typography variant="subtitle1" fontWeight="600" gutterBottom>
          Delete Account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Once you delete your account, there is no going back. This will permanently delete your
          profile, learning capsules, progress data, and all associated information.
        </Typography>
        <Button
          variant="outlined"
          color="error"
          startIcon={<Delete />}
          onClick={() => setShowDeleteDialog(true)}
        >
          Delete Account
        </Button>
      </Box>

      {/* Delete Account Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="error" />
          Delete Account
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you absolutely sure you want to delete your account? This action cannot be undone.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This will permanently delete:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Your profile and personal information" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• All learning capsules and content" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Study progress and statistics" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Subscription and billing information" />
            </ListItem>
          </List>
          <TextField
            fullWidth
            label="Type DELETE to confirm"
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="DELETE"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteAccount}
            disabled={isLoading || deleteConfirmation !== 'DELETE'}
            startIcon={isLoading ? <CircularProgress size={16} /> : <Delete />}
          >
            Delete Account
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};