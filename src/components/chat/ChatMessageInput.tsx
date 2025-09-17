import React, { useRef, useState } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachIcon,
  Mic as MicIcon,
  EmojiEmotions as EmojiIcon,
  Code as CodeIcon,
} from '@mui/icons-material';

interface ChatMessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyPress?: (event: React.KeyboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  showAttachment?: boolean;
  showVoice?: boolean;
  showEmoji?: boolean;
  showCode?: boolean;
  isLoading?: boolean;
  maxLength?: number;
}

export const ChatMessageInput: React.FC<ChatMessageInputProps> = ({
  value,
  onChange,
  onSend,
  onKeyPress,
  disabled = false,
  placeholder = "Type your message...",
  showAttachment = true,
  showVoice = false,
  showEmoji = false,
  showCode = false,
  isLoading = false,
  maxLength = 2000,
}) => {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleSend = () => {
    if (value.trim() && !disabled && !isLoading) {
      onSend();
    }
  };

  const handleAttachClick = (event: React.MouseEvent<HTMLElement>) => {
    if (showAttachment) {
      setMenuAnchor(event.currentTarget);
    }
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
    handleMenuClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Handle file upload logic here
      console.log('File selected:', file);
    }
  };

  const isOverLimit = value.length > maxLength;
  const canSend = value.trim() && !disabled && !isLoading && !isOverLimit;

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
      {/* Attachment Menu */}
      {showAttachment && (
        <>
          <Tooltip title="Attach file">
            <IconButton
              onClick={handleAttachClick}
              disabled={disabled}
              size="small"
            >
              <AttachIcon />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleFileUpload}>
              <AttachIcon sx={{ mr: 1 }} />
              Upload File
            </MenuItem>
            {showCode && (
              <MenuItem onClick={handleMenuClose}>
                <CodeIcon sx={{ mr: 1 }} />
                Code Snippet
              </MenuItem>
            )}
          </Menu>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleFileChange}
            accept=".txt,.pdf,.doc,.docx,.png,.jpg,.jpeg"
          />
        </>
      )}

      {/* Message Input */}
      <TextField
        fullWidth
        multiline
        maxRows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={onKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        error={isOverLimit}
        helperText={
          isOverLimit
            ? `Message too long (${value.length}/${maxLength})`
            : `${value.length}/${maxLength}`
        }
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 3,
          },
        }}
      />

      {/* Voice Input */}
      {showVoice && (
        <Tooltip title="Voice message">
          <IconButton disabled={disabled} size="small">
            <MicIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* Emoji Picker */}
      {showEmoji && (
        <Tooltip title="Add emoji">
          <IconButton disabled={disabled} size="small">
            <EmojiIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* Send Button */}
      <Tooltip title="Send message">
        <IconButton
          onClick={handleSend}
          disabled={!canSend}
          color="primary"
          sx={{
            backgroundColor: canSend ? theme.palette.primary.main : 'transparent',
            color: canSend ? theme.palette.primary.contrastText : theme.palette.action.disabled,
            '&:hover': {
              backgroundColor: canSend ? theme.palette.primary.dark : 'transparent',
            },
          }}
        >
          {isLoading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <SendIcon />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
};