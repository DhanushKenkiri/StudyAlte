import React, { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Avatar,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  PhotoCamera,
  Close,
} from '@mui/icons-material';
import { type AppDispatch } from '../../store';

interface AvatarUploadProps {
  open: boolean;
  onClose: () => void;
  currentAvatar: string | null;
  userId: string;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  open,
  onClose,
  currentAvatar,
  userId,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a JPEG, PNG, or WebP image file.');
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('File size must be less than 5MB.');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      // Step 1: Get pre-signed URL from backend
      const response = await fetch(`/api/users/${userId}/avatar/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, avatarUrl } = await response.json();

      // Step 2: Upload file to S3 using pre-signed URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Update Redux store with new avatar URL
      // This would typically be done through a Redux action
      // For now, we'll just close the dialog
      
      onClose();
      setSelectedFile(null);
      setPreviewUrl(null);
      
      // Refresh the page or update the user data
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete avatar');
      }

      onClose();
      // Refresh the page or update the user data
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    onClose();
  };

  const displayAvatar = previewUrl || currentAvatar;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Update Profile Picture
        <IconButton onClick={handleClose} disabled={isUploading}>
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
          {/* Avatar Preview */}
          <Box sx={{ position: 'relative', mb: 3 }}>
            <Avatar
              src={displayAvatar || undefined}
              sx={{
                width: 120,
                height: 120,
                fontSize: '3rem',
                bgcolor: 'primary.main',
              }}
            >
              {!displayAvatar && <PhotoCamera sx={{ fontSize: '3rem' }} />}
            </Avatar>
            
            {displayAvatar && (
              <IconButton
                sx={{
                  position: 'absolute',
                  bottom: -8,
                  right: -8,
                  bgcolor: 'error.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'error.dark',
                  },
                }}
                size="small"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                disabled={isUploading}
              >
                <Close fontSize="small" />
              </IconButton>
            )}
          </Box>

          {/* Upload Instructions */}
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
            Choose a photo that represents you well. It will be visible to other users if your profile is public.
          </Typography>

          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {/* Upload Button */}
          <Button
            variant="outlined"
            startIcon={<CloudUpload />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            sx={{ mb: 2 }}
          >
            Choose Photo
          </Button>

          {/* File Requirements */}
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Supported formats: JPEG, PNG, WebP<br />
            Maximum file size: 5MB<br />
            Recommended: Square image, at least 200x200 pixels
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          {/* Delete Avatar Button */}
          {currentAvatar && (
            <Button
              color="error"
              startIcon={<Delete />}
              onClick={handleDeleteAvatar}
              disabled={isUploading}
            >
              Remove Photo
            </Button>
          )}
          
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            <Button onClick={handleClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              startIcon={isUploading ? <CircularProgress size={16} /> : <CloudUpload />}
            >
              {isUploading ? 'Uploading...' : 'Upload Photo'}
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
};