import React, { useState } from 'react';
import {
  Box,
  CardContent,
  Typography,
  Card,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayIcon,
  ContentCopy as CopyIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  AccessTime as TimeIcon,
  Lightbulb as InsightIcon,
} from '@mui/icons-material';

interface CapsuleSummaryProps {
  capsuleData: any;
  onStartStudy?: (capsuleId: string, material: string) => void;
}

export const CapsuleSummary: React.FC<CapsuleSummaryProps> = ({
  capsuleData,
  onStartStudy,
}) => {
  const theme = useTheme();
  const [expandedSection, setExpandedSection] = useState<string | false>('section-0');
  const [bookmarkedSections, setBookmarkedSections] = useState<Set<string>>(new Set());

  const handleSectionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSection(isExpanded ? panel : false);
  };

  const handleBookmarkToggle = (sectionId: string) => {
    setBookmarkedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    // You could add a toast notification here
  };

  const formatTimestamp = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <CardContent>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Content Summary
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<PlayIcon />}
              onClick={() => onStartStudy?.(capsuleData.id, 'summary')}
            >
              Study Mode
            </Button>
            <Button
              variant="outlined"
              startIcon={<CopyIcon />}
              onClick={() => handleCopyContent(capsuleData.summary.content)}
            >
              Copy All
            </Button>
          </Box>
        </Box>

        {/* Key Points Overview */}
        <Card sx={{ mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <InsightIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Key Insights
              </Typography>
              <Chip
                label={`${capsuleData.summary.keyPoints.length} points`}
                size="small"
                sx={{ ml: 2 }}
              />
            </Box>
            
            <List dense>
              {capsuleData.summary.keyPoints.map((point: string, index: number) => (
                <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.primary.main,
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={point}
                    primaryTypographyProps={{
                      variant: 'body2',
                      sx: { lineHeight: 1.5 },
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        {/* Detailed Sections */}
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          Detailed Breakdown
        </Typography>
        
        {capsuleData.summary.sections.map((section: any, index: number) => {
          const sectionId = `section-${index}`;
          const isBookmarked = bookmarkedSections.has(sectionId);
          
          return (
            <Accordion
              key={sectionId}
              expanded={expandedSection === sectionId}
              onChange={handleSectionChange(sectionId)}
              sx={{
                mb: 1,
                '&:before': {
                  display: 'none',
                },
                boxShadow: theme.shadows[1],
                borderRadius: 2,
                '&.Mui-expanded': {
                  margin: '0 0 8px 0',
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  backgroundColor: alpha(theme.palette.background.paper, 0.8),
                  borderRadius: '8px 8px 0 0',
                  '&.Mui-expanded': {
                    borderRadius: '8px 8px 0 0',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mr: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
                    {section.title}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {section.timestamp && (
                      <Chip
                        icon={<TimeIcon />}
                        label={formatTimestamp(section.timestamp)}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                    
                    <Tooltip title={isBookmarked ? 'Remove bookmark' : 'Bookmark section'}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookmarkToggle(sectionId);
                        }}
                        sx={{ color: isBookmarked ? 'primary.main' : 'text.secondary' }}
                      >
                        {isBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="Copy section">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyContent(`${section.title}\n\n${section.content}`);
                        }}
                        sx={{ color: 'text.secondary' }}
                      >
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </AccordionSummary>
              
              <AccordionDetails sx={{ pt: 2 }}>
                <Typography
                  variant="body1"
                  sx={{
                    lineHeight: 1.7,
                    color: 'text.primary',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {section.content}
                </Typography>
                
                {section.timestamp && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                    <Button
                      size="small"
                      startIcon={<PlayIcon />}
                      onClick={() => {
                        // Navigate to video at timestamp
                        window.open(`${capsuleData.videoUrl}&t=${section.timestamp}s`, '_blank');
                      }}
                    >
                      Watch this section
                    </Button>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* Study Actions */}
        <Card sx={{ mt: 3, p: 3, textAlign: 'center', bgcolor: alpha(theme.palette.success.main, 0.05) }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Ready to test your understanding?
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Move on to flashcards and quizzes to reinforce what you've learned.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={() => onStartStudy?.(capsuleData.id, 'flashcards')}
            >
              Study Flashcards
            </Button>
            <Button
              variant="outlined"
              onClick={() => onStartStudy?.(capsuleData.id, 'quiz')}
            >
              Take Quiz
            </Button>
            <Button
              variant="outlined"
              onClick={() => onStartStudy?.(capsuleData.id, 'mindmap')}
            >
              View Mind Map
            </Button>
          </Box>
        </Card>
      </Box>
    </CardContent>
  );
};