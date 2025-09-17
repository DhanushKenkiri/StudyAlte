// Placeholder hook - will be implemented in authentication task
export const useAuth = () => {
  return {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: async () => {},
    logout: async () => {},
    register: async () => {},
  };
};