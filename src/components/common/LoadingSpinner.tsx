import { CircularProgress, Box } from '@mui/material';

export const LoadingSpinner = () => {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" p={2}>
      <CircularProgress />
    </Box>
  );
};