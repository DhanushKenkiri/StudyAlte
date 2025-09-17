import React from 'react';
import {
  Box,
  CardContent,
  Typography,
  Card,
  Button,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  AccountTree as MindMapIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

interface CapsuleMindMapProps {
  capsuleData: any;
  onStartStudy?: (capsuleId: string, material: string) => void;
}

export const CapsuleMindMap: React.FC<CapsuleMindMapProps> = ({
  capsuleData,
  onStartStudy,
}) => {
  const theme = useTheme();
  const mindMap = capsuleData.mindMap;

  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case 'main':
        return theme.palette.primary.main;
      case 'concept':
        return theme.palette.secondary.main;
      case 'detail':
        return theme.palette.info.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const nodeTypeBreakdown = {
    main: mindMap.nodes.filter((n: any) => n.type === 'main').length,
    concept: mindMap.nodes.filter((n: any) => n.type === 'concept').length,
    detail: mindMap.nodes.filter((n: any) => n.type === 'detail').length,
  };

  return (
    <CardContent>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Concept Mind Map
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
            >
              Export
            </Button>
            <Button
              variant="contained"
              startIcon={<MindMapIcon />}
              onClick={() => onStartStudy?.(capsuleData.id, 'mindmap')}
            >
              Interactive View
            </Button>
          </Box>
        </Box>

        {/* Mind Map Stats */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Chip
            label={`${mindMap.nodes.length} concepts`}
            sx={{
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
            }}
          />
          <Chip
            label={`${mindMap.edges.length} connections`}
            sx={{
              backgroundColor: alpha(theme.palette.secondary.main, 0.1),
              color: theme.palette.secondary.main,
            }}
          />
          <Chip
            label={`${nodeTypeBreakdown.main} main topics`}
            sx={{
              backgroundColor: alpha(theme.palette.success.main, 0.1),
              color: theme.palette.success.main,
            }}
          />
        </Box>

        {/* Mind Map Visualization Placeholder */}
        <Card sx={{ p: 3, mb: 3, minHeight: 400, position: 'relative' }}>
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              display: 'flex',
              gap: 1,
            }}
          >
            <Button size="small" startIcon={<ZoomInIcon />}>
              Zoom In
            </Button>
            <Button size="small" startIcon={<ZoomOutIcon />}>
              Zoom Out
            </Button>
            <Button size="small" startIcon={<CenterIcon />}>
              Center
            </Button>
          </Box>
          
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 350,
              bgcolor: alpha(theme.palette.background.default, 0.5),
              borderRadius: 2,
              border: `2px dashed ${theme.palette.divider}`,
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <MindMapIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Interactive Mind Map
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Click "Interactive View" to explore the full mind map with zoom, pan, and node interactions.
              </Typography>
              <Button
                variant="contained"
                onClick={() => onStartStudy?.(capsuleData.id, 'mindmap')}
              >
                Open Interactive View
              </Button>
            </Box>
          </Box>
        </Card>

        {/* Node Legend */}
        <Card sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Node Types
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: getNodeTypeColor('main'),
                }}
              />
              <Typography variant="body2">
                Main Topics ({nodeTypeBreakdown.main})
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: getNodeTypeColor('concept'),
                }}
              />
              <Typography variant="body2">
                Concepts ({nodeTypeBreakdown.concept})
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: getNodeTypeColor('detail'),
                }}
              />
              <Typography variant="body2">
                Details ({nodeTypeBreakdown.detail})
              </Typography>
            </Box>
          </Box>
        </Card>
      </Box>
    </CardContent>
  );
};