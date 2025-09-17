import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
  CssBaseline,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Fade,
  LinearProgress,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  VideoLibrary as VideoLibraryIcon,
  Quiz as QuizIcon,
  Psychology as PsychologyIcon,
  Notes as NotesIcon,
  AccountTree as MindMapIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingOverlay } from './LoadingOverlay';
import { useThemeMode } from '../../hooks/useThemeMode';

const DRAWER_WIDTH = 280;
const COLLAPSED_DRAWER_WIDTH = 64;

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactElement;
  path: string;
  badge?: number;
  disabled?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <HomeIcon />,
    path: '/',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <DashboardIcon />,
    path: '/dashboard',
  },
  {
    id: 'videos',
    label: 'Video Library',
    icon: <VideoLibraryIcon />,
    path: '/videos',
  },
  {
    id: 'flashcards',
    label: 'Flashcards',
    icon: <PsychologyIcon />,
    path: '/flashcards',
  },
  {
    id: 'quizzes',
    label: 'Quizzes',
    icon: <QuizIcon />,
    path: '/quizzes',
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: <NotesIcon />,
    path: '/notes',
  },
  {
    id: 'mindmaps',
    label: 'Mind Maps',
    icon: <MindMapIcon />,
    path: '/mindmaps',
  },
];

interface MainLayoutProps {
  children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Redux state
  const { user, isLoading: authLoading } = useAppSelector((state) => state.auth);
  const isGlobalLoading = useAppSelector((state) => state.ui?.isLoading || false);
  
  // Theme mode hook
  const { mode, toggleMode } = useThemeMode();
  
  // Local state
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // Auto-collapse drawer on mobile
  useEffect(() => {
    if (isMobile) {
      setDrawerOpen(false);
      setDrawerCollapsed(false);
    }
  }, [isMobile]);

  // Close drawer on route change (mobile)
  useEffect(() => {
    if (isMobile && drawerOpen) {
      setDrawerOpen(false);
    }
  }, [location.pathname, isMobile]);

  const handleDrawerToggle = () => {
    if (isMobile) {
      setDrawerOpen(!drawerOpen);
    } else {
      if (drawerOpen) {
        setDrawerCollapsed(!drawerCollapsed);
      } else {
        setDrawerOpen(true);
        setDrawerCollapsed(false);
      }
    }
  };

  const handleDrawerClose = () => {
    if (isMobile) {
      setDrawerOpen(false);
    } else {
      setDrawerOpen(false);
      setDrawerCollapsed(false);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    handleUserMenuClose();
    navigate('/login');
  };

  const handleProfile = () => {
    navigate('/profile');
    handleUserMenuClose();
  };

  const handleSettings = () => {
    navigate('/settings');
    handleUserMenuClose();
  };

  const isActiveRoute = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const getDrawerWidth = () => {
    if (!drawerOpen) return 0;
    if (drawerCollapsed && !isMobile) return COLLAPSED_DRAWER_WIDTH;
    return DRAWER_WIDTH;
  };

  const renderNavigationItems = () => (
    <List sx={{ px: drawerCollapsed && !isMobile ? 1 : 2 }}>
      {navigationItems.map((item) => (
        <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
          <Tooltip
            title={drawerCollapsed && !isMobile ? item.label : ''}
            placement="right"
            arrow
          >
            <ListItemButton
              onClick={() => handleNavigate(item.path)}
              disabled={item.disabled}
              selected={isActiveRoute(item.path)}
              sx={{
                borderRadius: 2,
                minHeight: 48,
                justifyContent: drawerCollapsed && !isMobile ? 'center' : 'flex-start',
                px: drawerCollapsed && !isMobile ? 1.5 : 2,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main + '20',
                  color: theme.palette.primary.main,
                  '& .MuiListItemIcon-root': {
                    color: theme.palette.primary.main,
                  },
                },
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: drawerCollapsed && !isMobile ? 0 : 40,
                  mr: drawerCollapsed && !isMobile ? 0 : 1,
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {(!drawerCollapsed || isMobile) && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActiveRoute(item.path) ? 600 : 400,
                  }}
                />
              )}
              {item.badge && item.badge > 0 && (!drawerCollapsed || isMobile) && (
                <Box
                  sx={{
                    backgroundColor: theme.palette.error.main,
                    color: theme.palette.error.contrastText,
                    borderRadius: '50%',
                    minWidth: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {item.badge}
                </Box>
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      ))}
    </List>
  );

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: drawerCollapsed && !isMobile ? 'center' : 'space-between',
          px: drawerCollapsed && !isMobile ? 1 : 2,
          py: 2,
          minHeight: 64,
        }}
      >
        {(!drawerCollapsed || isMobile) && (
          <Typography
            variant="h6"
            component="div"
            sx={{
              fontWeight: 700,
              color: theme.palette.primary.main,
              fontSize: '1.25rem',
            }}
          >
            LearnTube
          </Typography>
        )}
        {!isMobile && (
          <IconButton
            onClick={handleDrawerClose}
            size="small"
            sx={{
              color: theme.palette.text.secondary,
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      <Divider />

      {/* Navigation */}
      <Box sx={{ flex: 1, py: 2, overflowY: 'auto' }}>
        {renderNavigationItems()}
      </Box>

      <Divider />

      {/* Theme Toggle */}
      <Box sx={{ p: 2 }}>
        {(!drawerCollapsed || isMobile) ? (
          <FormControlLabel
            control={
              <Switch
                checked={mode === 'dark'}
                onChange={toggleMode}
                icon={<LightModeIcon />}
                checkedIcon={<DarkModeIcon />}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {mode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
                <Typography variant="body2">
                  {mode === 'dark' ? 'Dark' : 'Light'} Mode
                </Typography>
              </Box>
            }
            sx={{ m: 0 }}
          />
        ) : (
          <Tooltip title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} placement="right">
            <IconButton onClick={toggleMode} size="small">
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      
      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${getDrawerWidth()}px)` },
          ml: { md: `${getDrawerWidth()}px` },
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{
              mr: 2,
              color: theme.palette.text.primary,
            }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              flexGrow: 1,
              color: theme.palette.text.primary,
              fontWeight: 600,
            }}
          >
            {navigationItems.find(item => isActiveRoute(item.path))?.label || 'LearnTube'}
          </Typography>

          {/* Global Loading Indicator */}
          {isGlobalLoading && (
            <Box sx={{ mr: 2 }}>
              <LinearProgress
                sx={{
                  width: 100,
                  height: 2,
                  borderRadius: 1,
                }}
              />
            </Box>
          )}

          {/* User Menu */}
          {user && (
            <Box>
              <Tooltip title="Account settings">
                <IconButton
                  onClick={handleUserMenuOpen}
                  size="small"
                  sx={{ ml: 2 }}
                  aria-controls={Boolean(userMenuAnchor) ? 'account-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={Boolean(userMenuAnchor) ? 'true' : undefined}
                >
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: theme.palette.primary.main,
                      fontSize: '0.875rem',
                    }}
                  >
                    {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={userMenuAnchor}
                id="account-menu"
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                onClick={handleUserMenuClose}
                PaperProps={{
                  elevation: 0,
                  sx: {
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                    mt: 1.5,
                    '& .MuiAvatar-root': {
                      width: 32,
                      height: 32,
                      ml: -0.5,
                      mr: 1,
                    },
                    '&:before': {
                      content: '""',
                      display: 'block',
                      position: 'absolute',
                      top: 0,
                      right: 14,
                      width: 10,
                      height: 10,
                      bgcolor: 'background.paper',
                      transform: 'translateY(-50%) rotate(45deg)',
                      zIndex: 0,
                    },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <MenuItem onClick={handleProfile}>
                  <PersonIcon sx={{ mr: 2 }} />
                  Profile
                </MenuItem>
                <MenuItem onClick={handleSettings}>
                  <SettingsIcon sx={{ mr: 2 }} />
                  Settings
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon sx={{ mr: 2 }} />
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{
          width: { md: getDrawerWidth() },
          flexShrink: { md: 0 },
        }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          open={drawerOpen}
          onClose={handleDrawerClose}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerCollapsed && !isMobile ? COLLAPSED_DRAWER_WIDTH : DRAWER_WIDTH,
              backgroundColor: theme.palette.background.paper,
              borderRight: `1px solid ${theme.palette.divider}`,
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${getDrawerWidth()}px)` },
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar /> {/* Spacer for fixed AppBar */}
        
        <ErrorBoundary>
          <Fade in timeout={300}>
            <Box sx={{ p: { xs: 2, sm: 3 }, minHeight: 'calc(100vh - 64px)' }}>
              {children || <Outlet />}
            </Box>
          </Fade>
        </ErrorBoundary>

        {/* Global Loading Overlay */}
        <LoadingOverlay open={authLoading} />
      </Box>
    </Box>
  );
};