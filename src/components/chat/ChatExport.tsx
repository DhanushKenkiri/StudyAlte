import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  Typography,
  Box,
  Divider,
  Alert,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Description as TextIcon,
  Code as JsonIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { ChatSession } from './ChatInterface';

interface ChatExportProps {
  session?: ChatSession;
  open: boolean;
  onClose: () => void;
  onExport?: () => void;
}

export const ChatExport: React.FC<ChatExportProps> = ({
  session,
  open,
  onClose,
  onExport,
}) => {
  const [format, setFormat] = useState<'txt' | 'json' | 'pdf'>('txt');
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [includeReactions, setIncludeReactions] = useState(false);

  const handleExport = () => {
    if (!session) return;

    let content = '';
    let filename = `chat-${session.id}`;
    let mimeType = 'text/plain';

    switch (format) {
      case 'txt':
        content = exportToText();
        filename += '.txt';
        mimeType = 'text/plain';
        break;
      
      case 'json':
        content = exportToJson();
        filename += '.json';
        mimeType = 'application/json';
        break;
      
      case 'pdf':
        // For PDF, we would need a PDF library like jsPDF
        // For now, fallback to text
        content = exportToText();
        filename += '.txt';
        mimeType = 'text/plain';
        break;
    }

    // Create and download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onExport?.();
    onClose();
  };

  const exportToText = (): string => {
    if (!session) return '';

    let content = `Chat Export: ${session.title}\n`;
    content += `Created: ${new Date(session.createdAt).toLocaleString()}\n`;
    content += `Updated: ${new Date(session.updatedAt).toLocaleString()}\n`;
    
    if (session.context?.videoTitle) {
      content += `Video: ${session.context.videoTitle}\n`;
    }
    
    content += `Messages: ${session.messages.length}\n`;
    content += '='.repeat(50) + '\n\n';

    session.messages.forEach((message, index) => {
      const sender = message.sender === 'user' ? 'You' : 'AI Tutor';
      
      if (includeTimestamps) {
        content += `[${new Date(message.timestamp).toLocaleString()}] `;
      }
      
      content += `${sender}:\n`;
      content += `${message.content}\n`;

      if (includeMetadata && message.metadata) {
        if (message.metadata.confidence) {
          content += `  Confidence: ${Math.round(message.metadata.confidence * 100)}%\n`;
        }
        if (message.metadata.relatedConcepts?.length) {
          content += `  Related: ${message.metadata.relatedConcepts.join(', ')}\n`;
        }
        if (message.metadata.sources?.length) {
          content += `  Sources: ${message.metadata.sources.join(', ')}\n`;
        }
      }

      if (includeReactions && message.reactions) {
        const { thumbsUp, thumbsDown, userReaction } = message.reactions;
        if (thumbsUp > 0 || thumbsDown > 0) {
          content += `  Reactions: 👍 ${thumbsUp} 👎 ${thumbsDown}`;
          if (userReaction) {
            content += ` (You: ${userReaction === 'up' ? '👍' : '👎'})`;
          }
          content += '\n';
        }
      }

      if (index < session.messages.length - 1) {
        content += '\n' + '-'.repeat(30) + '\n\n';
      }
    });

    return content;
  };

  const exportToJson = (): string => {
    if (!session) return '';

    const exportData = {
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        context: session.context,
      },
      messages: session.messages.map(message => ({
        id: message.id,
        content: message.content,
        sender: message.sender,
        timestamp: message.timestamp,
        type: message.type,
        ...(includeMetadata && { metadata: message.metadata }),
        ...(includeReactions && { reactions: message.reactions }),
        ...(message.isEdited && { 
          isEdited: message.isEdited,
          editedAt: message.editedAt 
        }),
      })),
      exportSettings: {
        format,
        includeTimestamps,
        includeMetadata,
        includeReactions,
        exportedAt: new Date().toISOString(),
      },
    };

    return JSON.stringify(exportData, null, 2);
  };

  const getFormatIcon = (formatType: string) => {
    switch (formatType) {
      case 'txt':
        return <TextIcon />;
      case 'json':
        return <JsonIcon />;
      case 'pdf':
        return <PdfIcon />;
      default:
        return <TextIcon />;
    }
  };

  const getEstimatedSize = () => {
    if (!session) return '0 KB';
    
    const baseSize = session.messages.reduce((acc, msg) => acc + msg.content.length, 0);
    const multiplier = format === 'json' ? 2.5 : 1.2; // JSON has more overhead
    const estimatedBytes = baseSize * multiplier;
    
    if (estimatedBytes < 1024) return `${Math.round(estimatedBytes)} B`;
    if (estimatedBytes < 1024 * 1024) return `${Math.round(estimatedBytes / 1024)} KB`;
    return `${Math.round(estimatedBytes / (1024 * 1024))} MB`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon />
          Export Chat
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {!session ? (
          <Alert severity="warning">
            No chat session available to export.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Session Info */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Chat Session
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {session.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {session.messages.length} messages • Created {new Date(session.createdAt).toLocaleDateString()}
              </Typography>
            </Box>

            <Divider />

            {/* Format Selection */}
            <FormControl component="fieldset">
              <FormLabel component="legend">Export Format</FormLabel>
              <RadioGroup
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
              >
                <FormControlLabel
                  value="txt"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextIcon fontSize="small" />
                      <Box>
                        <Typography variant="body2">Plain Text</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Human-readable format
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="json"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <JsonIcon fontSize="small" />
                      <Box>
                        <Typography variant="body2">JSON</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Structured data format
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="pdf"
                  control={<Radio />}
                  disabled
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PdfIcon fontSize="small" />
                      <Box>
                        <Typography variant="body2">PDF</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Coming soon
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>

            <Divider />

            {/* Export Options */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Include in Export
              </Typography>
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeTimestamps}
                    onChange={(e) => setIncludeTimestamps(e.target.checked)}
                  />
                }
                label="Timestamps"
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeMetadata}
                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                  />
                }
                label="Message metadata (confidence, sources, etc.)"
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeReactions}
                    onChange={(e) => setIncludeReactions(e.target.checked)}
                  />
                }
                label="Message reactions"
              />
            </Box>

            {/* File Info */}
            <Box
              sx={{
                p: 2,
                backgroundColor: 'grey.50',
                borderRadius: 1,
                border: `1px solid`,
                borderColor: 'grey.200',
              }}
            >
              <Typography variant="body2" gutterBottom>
                Export Preview
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Format: {format.toUpperCase()} • Estimated size: {getEstimatedSize()}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={!session}
          startIcon={<DownloadIcon />}
        >
          Export
        </Button>
      </DialogActions>
    </Dialog>
  );
};