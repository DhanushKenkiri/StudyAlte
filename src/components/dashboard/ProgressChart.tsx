import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
  Chip,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
} from 'recharts';
import { format, subDays, startOfWeek, startOfMonth, startOfYear } from 'date-fns';

interface ProgressChartProps {
  timeRange: 'week' | 'month' | 'year';
  onTimeRangeChange: (range: 'week' | 'month' | 'year') => void;
  data: any; // Dashboard data
  loading?: boolean;
}

interface ChartDataPoint {
  date: string;
  videos: number;
  notes: number;
  flashcards: number;
  quizzes: number;
  studyTime: number;
  totalActivities: number;
}

export const ProgressChart: React.FC<ProgressChartProps> = ({
  timeRange,
  onTimeRangeChange,
  data,
  loading = false,
}) => {
  const theme = useTheme();
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('area');

  // Generate mock chart data based on time range
  const chartData = useMemo(() => {
    const generateData = (): ChartDataPoint[] => {
      const now = new Date();
      const dataPoints: ChartDataPoint[] = [];
      
      let days: number;
      let startDate: Date;
      let formatString: string;
      
      switch (timeRange) {
        case 'week':
          days = 7;
          startDate = startOfWeek(now);
          formatString = 'EEE';
          break;
        case 'month':
          days = 30;
          startDate = startOfMonth(now);
          formatString = 'MMM dd';
          break;
        case 'year':
          days = 12;
          startDate = startOfYear(now);
          formatString = 'MMM';
          break;
        default:
          days = 7;
          startDate = startOfWeek(now);
          formatString = 'EEE';
      }
      
      for (let i = 0; i < days; i++) {
        const date = timeRange === 'year' 
          ? new Date(startDate.getFullYear(), i, 1)
          : subDays(now, days - 1 - i);
        
        // Generate realistic mock data with some randomness
        const baseActivity = Math.max(0, Math.sin(i * 0.5) * 5 + 5 + Math.random() * 3);
        const videos = Math.floor(baseActivity * 0.3 + Math.random() * 2);
        const notes = Math.floor(baseActivity * 0.8 + Math.random() * 3);
        const flashcards = Math.floor(baseActivity * 2 + Math.random() * 5);
        const quizzes = Math.floor(baseActivity * 0.2 + Math.random());
        const studyTime = Math.floor(baseActivity * 15 + Math.random() * 30);
        
        dataPoints.push({
          date: format(date, formatString),
          videos,
          notes,
          flashcards,
          quizzes,
          studyTime,
          totalActivities: videos + notes + flashcards + quizzes,
        });
      }
      
      return dataPoints;
    };
    
    return generateData();
  }, [timeRange]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalVideos = chartData.reduce((sum, point) => sum + point.videos, 0);
    const totalStudyTime = chartData.reduce((sum, point) => sum + point.studyTime, 0);
    const totalActivities = chartData.reduce((sum, point) => sum + point.totalActivities, 0);
    const avgDailyActivities = totalActivities / chartData.length;
    
    return {
      totalVideos,
      totalStudyTime,
      totalActivities,
      avgDailyActivities,
    };
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: 'background.paper',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            p: 2,
            boxShadow: theme.shadows[4],
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: entry.color,
                  borderRadius: '50%',
                  mr: 1,
                }}
              />
              <Typography variant="body2" sx={{ mr: 1 }}>
                {entry.name}:
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {entry.value}
                {entry.dataKey === 'studyTime' ? ' min' : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="videos"
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              dot={{ fill: theme.palette.primary.main, strokeWidth: 2, r: 4 }}
              name="Videos"
            />
            <Line
              type="monotone"
              dataKey="notes"
              stroke={theme.palette.success.main}
              strokeWidth={2}
              dot={{ fill: theme.palette.success.main, strokeWidth: 2, r: 4 }}
              name="Notes"
            />
            <Line
              type="monotone"
              dataKey="flashcards"
              stroke={theme.palette.warning.main}
              strokeWidth={2}
              dot={{ fill: theme.palette.warning.main, strokeWidth: 2, r: 4 }}
              name="Flashcards"
            />
          </LineChart>
        );
      
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="totalActivities"
              stroke={theme.palette.primary.main}
              fill={alpha(theme.palette.primary.main, 0.2)}
              strokeWidth={2}
              name="Total Activities"
            />
            <Area
              type="monotone"
              dataKey="studyTime"
              stroke={theme.palette.secondary.main}
              fill={alpha(theme.palette.secondary.main, 0.2)}
              strokeWidth={2}
              name="Study Time"
            />
          </AreaChart>
        );
      
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="videos" fill={theme.palette.primary.main} name="Videos" />
            <Bar dataKey="notes" fill={theme.palette.success.main} name="Notes" />
            <Bar dataKey="flashcards" fill={theme.palette.warning.main} name="Flashcards" />
            <Bar dataKey="quizzes" fill={theme.palette.error.main} name="Quizzes" />
          </BarChart>
        );
      
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card sx={{ height: 400 }}>
        <CardContent>
          <Box sx={{ height: '100%', bgcolor: 'action.hover', borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: 400 }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TimelineIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" component="h2">
              Learning Progress
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* Chart Type Toggle */}
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_, newType) => newType && setChartType(newType)}
              size="small"
            >
              <ToggleButton value="area">Area</ToggleButton>
              <ToggleButton value="line">Line</ToggleButton>
              <ToggleButton value="bar">Bar</ToggleButton>
            </ToggleButtonGroup>
            
            {/* Time Range Toggle */}
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(_, newRange) => newRange && onTimeRangeChange(newRange)}
              size="small"
            >
              <ToggleButton value="week">Week</ToggleButton>
              <ToggleButton value="month">Month</ToggleButton>
              <ToggleButton value="year">Year</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {/* Summary Stats */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Chip
            icon={<TrendingUpIcon />}
            label={`${summaryStats.totalActivities} activities`}
            variant="outlined"
            size="small"
          />
          <Chip
            label={`${summaryStats.totalStudyTime} min study time`}
            variant="outlined"
            size="small"
          />
          <Chip
            label={`${summaryStats.avgDailyActivities.toFixed(1)} avg/day`}
            variant="outlined"
            size="small"
          />
        </Box>

        {/* Chart */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};