import { Amplify } from '@aws-amplify/core';

/**
 * AWS Amplify Configuration for Authentication
 */
export interface AuthConfig {
  userPoolId: string;
  userPoolWebClientId: string;
  identityPoolId: string;
  region: string;
  apiUrl: string;
}

/**
 * Get authentication configuration from environment variables
 */
export function getAuthConfig(): AuthConfig {
  const config = {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
    userPoolWebClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || '',
    identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || '',
    region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
    apiUrl: import.meta.env.VITE_API_URL || '',
  };

  // Validate required configuration
  const requiredFields = ['userPoolId', 'userPoolWebClientId', 'identityPoolId', 'apiUrl'];
  const missingFields = requiredFields.filter(field => !config[field as keyof AuthConfig]);
  
  if (missingFields.length > 0) {
    console.warn('Missing authentication configuration:', missingFields);
  }

  return config;
}

/**
 * Configure AWS Amplify with authentication settings
 */
export function configureAmplify(): void {
  const config = getAuthConfig();

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolWebClientId,
        identityPoolId: config.identityPoolId,
        loginWith: {
          email: true,
          username: false,
          phone: false,
        },
        signUpVerificationMethod: 'code',
        userAttributes: {
          email: {
            required: true,
          },
          given_name: {
            required: true,
          },
          family_name: {
            required: false,
          },
        },
        allowGuestAccess: false,
        passwordFormat: {
          minLength: 8,
          requireLowercase: true,
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialCharacters: true,
        },
      },
    },
    API: {
      REST: {
        'youtube-learning-api': {
          endpoint: config.apiUrl,
          region: config.region,
        },
      },
    },
  });
}

/**
 * Default authentication configuration for development
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  userPoolId: 'us-east-1_example123',
  userPoolWebClientId: 'example123456789',
  identityPoolId: 'us-east-1:example-1234-5678-9012',
  region: 'us-east-1',
  apiUrl: 'https://api.example.com',
};