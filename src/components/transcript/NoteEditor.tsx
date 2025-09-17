import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Chip,
  Typography,
  FormControlLabel,
  Switch,
  Paper,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';

interface NoteEditorProps {
  segmentId: string;
  segmentText: string;
  initialContent?: string;
  initialTags?: string[];
  initialIsPrivate?: boolean;
  onSubmit: (content: string, tags: string[], isPrivate: boolean) => void;
  onCancel: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  segmentId,
  segmentText,
  initialContent = '',
  initialTags = [],
  initialIsPrivate = false,
  onSubmit,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTag, setNewTag] = useState('');
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim(), tags, isPrivate);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && event.ctrlKey) {
      handleSubmit();
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Segment Context */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Transcript Segment:
        </Typography>
        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
          "{segmentText}"
        </Typography>
      </Paper>

      {/* Note Content */}
      <TextField
        fullWidth
        multiline
        rows={4}
        label="Your Note"
        placeholder="Add your thoughts, insights, or questions about this segment..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyPress={handleKeyPress}
        sx={{ mb: 2 }}
        autoFocus
      />

      {/* Tags Section */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Tags
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <TextField
            size="small"
            placeholder="Add tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            sx={{ flexGrow: 1 }}
          />
          <Tooltip title="Add tag">
            <IconButton
              size="small"
              onClick={handleAddTag}
              disabled={!newTag.trim() || tags.includes(newTag.trim())}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Tag List */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              onDelete={() => handleRemoveTag(tag)}
              deleteIcon={<CloseIcon />}
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      </Box>

      {/* Privacy Setting */}
      <FormControlLabel
        control={
          <Switch
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            color="primary"
          />
        }
        label="Private note (only visible to you)"
        sx={{ mb: 2 }}
      />

      <Divider sx={{ mb: 2 }} />

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onCancel}
          startIcon={<CancelIcon />}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!content.trim()}
          startIcon={<SaveIcon />}
        >
          Save Note
        </Button>
      </Box>

      {/* Keyboard Shortcut Hint */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1, display: 'block', textAlign: 'center' }}
      >
        Press Ctrl+Enter to save quickly
      </Typography>
    </Box>
  );
};