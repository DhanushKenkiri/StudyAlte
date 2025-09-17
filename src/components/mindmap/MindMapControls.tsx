import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  ButtonGroup,
  Button,
  Slider,
  Typography,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  FormControlLabel,
  Switch,
  Divider,
  Chip,
  useTheme,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  Fullscreen as FullscreenIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewModule as GridIcon,
  AccountTree as HierarchyIcon,
  RadioButtonUnchecked as RadialIcon,
  Share as NetworkIcon,
  Palette as ColorIcon,
  Label as LabelIcon,
  Timeline as ConnectionIcon,
  ZoomOutMap as FitIcon,
} from '@mui/icons-material';

interface MindMapControlsProps {
  zoom: number;
  layoutType: 'hierarchical' | 'radial' | 'network';
  colorScheme: 'default' | 'categorical' | 'importance' | 'difficulty';
  showLabels: boolean;
  showConnections: boolean;
  nodeSize: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  onLayoutChange: (layout: 'hierarchical' | 'radial' | 'network') => void;
  onColorSchemeChange: (scheme: 'default' | 'categorical' | 'importance' | 'difficulty') => void;
  onShowLabelsChange: (show: boolean) => void;
  onShowConnectionsChange: (show: boolean) => void;
  onNodeSizeChange: (size: number) => void;
  onExport: (format: 'svg' | 'png' | 'json') => void;
  onSearch: (query: string) => void;
}

export const MindMapControls: React.FC<MindMapControlsProps> = ({
  zoom,
  layoutType,
  colorScheme,
  showLabels,
  showConnections,
  nodeSize,
  onZoomIn,
  onZoomOut,
  onCenter,
  onLayoutChange,
  onColorSchemeChange,
  onShowLabelsChange,
  onShowConnectionsChange,
  onNodeSizeChange,
  onExport,
  onSearch,
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMenuAnchor, setLayoutMenuAnchor] = useState<null | HTMLElement>(null);
  const [colorMenuAnchor, setColorMenuAnchor] = useState<null | HTMLElement>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState<null | HTMLElement>(null);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  const handleLayoutMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLayoutMenuAnchor(event.currentTarget);
  };

  const handleLayoutMenuClose = () => {
    setLayoutMenuAnchor(null);
  };

  const handleLayoutSelect = (layout: 'hierarchical' | 'radial' | 'network') => {
    onLayoutChange(layout);
    handleLayoutMenuClose();
  };

  const handleColorMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setColorMenuAnchor(event.currentTarget);
  };

  const handleColorMenuClose = () => {
    setColorMenuAnchor(null);
  };

  const handleColorSchemeSelect = (scheme: 'default' | 'categorical' | 'importance' | 'difficulty') => {
    onColorSchemeChange(scheme);
    handleColorMenuClose();
  };

  const handleExportMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setExportMenuAnchor(event.currentTarget);
  };

  const handleExportMenuClose = () => {
    setExportMenuAnchor(null);
  };

  const handleExport = (format: 'svg' | 'png' | 'json') => {
    onExport(format);
    handleExportMenuClose();
  };

  const handleSettingsMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsMenuAnchor(event.currentTarget);
  };

  const handleSettingsMenuClose = () => {
    setSettingsMenuAnchor(null);
  };

  const getLayoutIcon = () => {
    switch (layoutType) {
      case 'hierarchical':
        return <HierarchyIcon />;
      case 'radial':
        return <RadialIcon />;
      case 'network':
        return <NetworkIcon />;
      default:
        return <GridIcon />;
    }
  };

  const getColorSchemeLabel = () => {
    switch (colorScheme) {
      case 'categorical':
        return 'Category';
      case 'importance':
        return 'Importance';
      case 'difficulty':
        return 'Difficulty';
      default:
        return 'Default';
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderBottom: `1px solid ${theme.palette.divider}`,
        flexWrap: 'wrap',
      }}
    >
      {/* Search */}
      <TextField
        size="small"
        placeholder="Search nodes..."
        value={searchQuery}
        onChange={handleSearchChange}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{ minWidth: 200 }}
      />

      <Divider orientation="vertical" flexItem />

      {/* Zoom Controls */}
      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Zoom In">
          <IconButton onClick={onZoomIn}>
            <ZoomInIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom Out">
          <IconButton onClick={onZoomOut}>
            <ZoomOutIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Center View">
          <IconButton onClick={onCenter}>
            <CenterIcon />
          </IconButton>
        </Tooltip>
      </ButtonGroup>

      {/* Zoom Level Display */}
      <Chip
        label={`${Math.round(zoom * 100)}%`}
        size="small"
        variant="outlined"
      />

      <Divider orientation="vertical" flexItem />

      {/* Layout Selection */}
      <Tooltip title="Change Layout">
        <Button
          size="small"
          variant="outlined"
          startIcon={getLayoutIcon()}
          onClick={handleLayoutMenuOpen}
        >
          {layoutType}
        </Button>
      </Tooltip>

      <Menu
        anchorEl={layoutMenuAnchor}
        open={Boolean(layoutMenuAnchor)}
        onClose={handleLayoutMenuClose}
      >
        <MenuItem
          onClick={() => handleLayoutSelect('hierarchical')}
          selected={layoutType === 'hierarchical'}
        >
          <HierarchyIcon sx={{ mr: 1 }} />
          Hierarchical
        </MenuItem>
        <MenuItem
          onClick={() => handleLayoutSelect('radial')}
          selected={layoutType === 'radial'}
        >
          <RadialIcon sx={{ mr: 1 }} />
          Radial
        </MenuItem>
        <MenuItem
          onClick={() => handleLayoutSelect('network')}
          selected={layoutType === 'network'}
        >
          <NetworkIcon sx={{ mr: 1 }} />
          Network
        </MenuItem>
      </Menu>

      {/* Color Scheme */}
      <Tooltip title="Color Scheme">
        <Button
          size="small"
          variant="outlined"
          startIcon={<ColorIcon />}
          onClick={handleColorMenuOpen}
        >
          {getColorSchemeLabel()}
        </Button>
      </Tooltip>

      <Menu
        anchorEl={colorMenuAnchor}
        open={Boolean(colorMenuAnchor)}
        onClose={handleColorMenuClose}
      >
        <MenuItem
          onClick={() => handleColorSchemeSelect('default')}
          selected={colorScheme === 'default'}
        >
          Default
        </MenuItem>
        <MenuItem
          onClick={() => handleColorSchemeSelect('categorical')}
          selected={colorScheme === 'categorical'}
        >
          By Category
        </MenuItem>
        <MenuItem
          onClick={() => handleColorSchemeSelect('importance')}
          selected={colorScheme === 'importance'}
        >
          By Importance
        </MenuItem>
        <MenuItem
          onClick={() => handleColorSchemeSelect('difficulty')}
          selected={colorScheme === 'difficulty'}
        >
          By Difficulty
        </MenuItem>
      </Menu>

      <Divider orientation="vertical" flexItem />

      {/* View Options */}
      <Tooltip title="Toggle Labels">
        <IconButton
          size="small"
          color={showLabels ? 'primary' : 'default'}
          onClick={() => onShowLabelsChange(!showLabels)}
        >
          <LabelIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Toggle Connections">
        <IconButton
          size="small"
          color={showConnections ? 'primary' : 'default'}
          onClick={() => onShowConnectionsChange(!showConnections)}
        >
          <ConnectionIcon />
        </IconButton>
      </Tooltip>

      {/* Node Size Slider */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
        <Typography variant="caption" color="text.secondary">
          Size
        </Typography>
        <Slider
          size="small"
          value={nodeSize}
          onChange={(_, value) => onNodeSizeChange(value as number)}
          min={0.5}
          max={2}
          step={0.1}
          sx={{ width: 80 }}
        />
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* Export */}
      <Tooltip title="Export">
        <IconButton size="small" onClick={handleExportMenuOpen}>
          <DownloadIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={handleExportMenuClose}
      >
        <MenuItem onClick={() => handleExport('svg')}>
          Export as SVG
        </MenuItem>
        <MenuItem onClick={() => handleExport('png')}>
          Export as PNG
        </MenuItem>
        <MenuItem onClick={() => handleExport('json')}>
          Export as JSON
        </MenuItem>
      </Menu>

      {/* Settings */}
      <Tooltip title="Settings">
        <IconButton size="small" onClick={handleSettingsMenuOpen}>
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={settingsMenuAnchor}
        open={Boolean(settingsMenuAnchor)}
        onClose={handleSettingsMenuClose}
        PaperProps={{
          sx: { minWidth: 250, p: 1 },
        }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Display Options
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={showLabels}
                onChange={(e) => onShowLabelsChange(e.target.checked)}
                size="small"
              />
            }
            label="Show Labels"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={showConnections}
                onChange={(e) => onShowConnectionsChange(e.target.checked)}
                size="small"
              />
            }
            label="Show Connections"
          />

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Node Size: {nodeSize.toFixed(1)}x
            </Typography>
            <Slider
              value={nodeSize}
              onChange={(_, value) => onNodeSizeChange(value as number)}
              min={0.5}
              max={2}
              step={0.1}
              size="small"
            />
          </Box>
        </Box>
      </Menu>
    </Box>
  );
};