# AWS Cognito Setup

This document describes the comprehensive AWS Cognito configuration for the YouTube Learning Platform, including User Pool, Identity Pool, and Lambda triggers.

## Overview

The authentication system uses AWS Cognito to provide:

- **User Pool**: Manages user registration, authentication, and profile data
- **Identity Pool**: Provides temporary AWS credentials for authenticated users
- **Lambda Triggers**: Custom business logic during authentication flows
- **Multi-Factor Authentication**: Optional TOTP-based MFA for enhanced security
- **Advanced Security**: Risk-based authentication and anomaly detection

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   User Pool     │    │  Identity Pool  │
│   Application   │◄──►│   (Auth)        │◄──►│  (AWS Access)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Lambda Triggers │    │   IAM Roles     │
                       │ (Business Logic)│    │ (Permissions)   │
                       └─────────────────┘    └─────────────────┘
```

## User Pool Configuration

### Basic Settings
- **Pool Name**: `youtube-learning-platform-{environment}-users`
- **Sign-in Method**: Email address only
- **Auto-verification**: Email required
- **Self-registration**: Enabled
- **Case sensitivity**: Case insensitive

### Password Policy
- **Minimum length**: 8 characters
- **Require lowercase**: Yes
- **Require uppercase**: Yes
- **Require numbers**: Yes
- **Require symbols**: Yes
- **Temporary password validity**: 7 days

### Multi-Factor Authentication
- **MFA Configuration**: Optional
- **Enabled methods**: Software Token (TOTP)
- **SMS MFA**: Disabled (cost optimization)

### Advanced Security
- **Mode**: Enforced
- **Risk-based authentication**: Enabled
- **Compromised credentials detection**: Enabled
- **Adaptive authentication**: Enabled

### Device Tracking
- **Challenge on new device**: Yes
- **Remember devices**: Only on user prompt
- **Device fingerprinting**: Enabled

## User Attributes

### Standard Attributes
| Attribute | Required | Mutable | Description |
|-----------|----------|---------|-------------|
| `email` | Yes | Yes | User's email address |
| `given_name` | Yes | Yes | First name |
| `family_name` | No | Yes | Last name |
| `preferred_username` | No | Yes | Display name |

### Custom Attributes
| Attribute | Type | Max Length | Description |
|-----------|------|------------|-------------|
| `learning_preferences` | String | 2048 | JSON string of learning preferences |
| `subscription_tier` | String | 50 | User's subscription level |
| `onboarding_completed` | Boolean | - | Whether user completed onboarding |

## User Pool Clients

### Web Client
- **Client Name**: `youtube-learning-platform-{environment}-web-client`
- **Client Secret**: None (public client)
- **Auth Flows**: SRP only (secure)
- **OAuth Flows**: Authorization Code Grant
- **OAuth Scopes**: `openid`, `email`, `profile`, `aws.cognito.signin.user.admin`
- **Token Validity**:
  - Access Token: 1 hour
  - ID Token: 1 hour
  - Refresh Token: 30 days
- **Callback URLs**: 
  - Development: `http://localhost:5173/auth/callback`
  - Production: `https://app.youtubelearning.com/auth/callback`
- **Logout URLs**:
  - Development: `http://localhost:5173/auth/logout`
  - Production: `https://app.youtubelearning.com/auth/logout`

### Mobile Client
- **Client Name**: `youtube-learning-platform-{environment}-mobile-client`
- **Client Secret**: None
- **Auth Flows**: SRP only
- **OAuth**: Disabled (native mobile app)
- **Token Validity**: Same as web client

### Security Features
- **Prevent user existence errors**: Enabled
- **Token revocation**: Enabled
- **Advanced security**: Inherited from User Pool

## Identity Pool Configuration

### Basic Settings
- **Pool Name**: `youtube-learning-platform-{environment}-identity`
- **Unauthenticated access**: Disabled
- **Authentication providers**: Cognito User Pool only

### Role Mapping
- **Type**: Token-based
- **Ambiguous role resolution**: Use authenticated role
- **Identity provider**: Cognito User Pool

## IAM Roles and Permissions

### Authenticated Role
Permissions for authenticated users:

#### Cognito Identity Access
```json
{
  "Effect": "Allow",
  "Action": [
    "cognito-identity:GetCredentialsForIdentity",
    "cognito-identity:GetId"
  ],
  "Resource": "*"
}
```

#### DynamoDB Access (User-Isolated)
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:DeleteItem",
    "dynamodb:Query"
  ],
  "Resource": [
    "arn:aws:dynamodb:region:account:table/table-name",
    "arn:aws:dynamodb:region:account:table/table-name/index/*"
  ],
  "Condition": {
    "ForAllValues:StringEquals": {
      "dynamodb:LeadingKeys": ["${cognito-identity.amazonaws.com:sub}"]
    }
  }
}
```

#### S3 Access (User-Isolated)
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject"
  ],
  "Resource": "arn:aws:s3:::bucket-name/users/${cognito-identity.amazonaws.com:sub}/*"
}
```

### Unauthenticated Role
Minimal permissions for unauthenticated users:
- `cognito-identity:GetId` only

## Lambda Triggers

### Pre Sign-up Trigger
**Function**: `pre-signup.handler`
**Purpose**: Validate and customize user registration

**Features**:
- Email domain validation
- Blocked domain checking
- Auto-confirmation for trusted domains
- Custom attribute initialization
- Business logic validation

**Environment Variables**:
- `TRUSTED_DOMAINS`: Comma-separated list of auto-confirm domains
- `LOG_LEVEL`: Logging level

### Post Confirmation Trigger
**Function**: `post-confirmation.handler`
**Purpose**: Initialize user data after email confirmation

**Features**:
- Create user profile in DynamoDB
- Initialize user settings
- Create welcome learning capsule (optional)
- Set up default preferences

**Environment Variables**:
- `DYNAMODB_TABLE_NAME`: Main table name
- `CREATE_WELCOME_CAPSULE`: Whether to create welcome content
- `LOG_LEVEL`: Logging level

### Custom Message Trigger
**Function**: `custom-message.handler`
**Purpose**: Customize email and SMS messages

**Features**:
- Branded email templates
- Personalized messages
- HTML email formatting
- Multi-language support (future)

**Environment Variables**:
- `FRONTEND_URL`: Application URL for links
- `LOG_LEVEL`: Logging level

**Message Types**:
- Email verification
- Password reset
- Welcome messages
- MFA codes
- Attribute verification

## Authentication Flows

### Registration Flow
1. User submits registration form
2. **Pre Sign-up Trigger** validates email and sets attributes
3. Cognito creates user in UNCONFIRMED status
4. **Custom Message Trigger** sends verification email
5. User clicks verification link or enters code
6. **Post Confirmation Trigger** creates user profile
7. User is confirmed and can sign in

### Sign-in Flow
1. User enters email and password
2. Cognito validates credentials
3. Advanced Security evaluates risk
4. MFA challenge (if enabled and required)
5. Tokens issued (Access, ID, Refresh)
6. Identity Pool provides AWS credentials

### Password Reset Flow
1. User requests password reset
2. **Custom Message Trigger** sends reset email
3. User enters verification code and new password
4. Password updated in Cognito
5. User can sign in with new password

## Security Best Practices

### Implemented Security Measures
- **SRP Authentication**: Secure Remote Password protocol
- **Advanced Security Mode**: Risk-based authentication
- **Device Tracking**: Monitor and challenge new devices
- **Token Revocation**: Ability to invalidate tokens
- **User Isolation**: DynamoDB and S3 access restricted by user ID
- **Prevent User Enumeration**: Hide user existence errors
- **Strong Password Policy**: Enforce complex passwords
- **Optional MFA**: TOTP-based second factor

### Security Recommendations
- Enable MFA for admin users
- Monitor CloudWatch logs for suspicious activity
- Regularly rotate client secrets (if using confidential clients)
- Implement rate limiting on authentication endpoints
- Use HTTPS only for all authentication flows
- Validate JWT tokens on the backend

## Monitoring and Logging

### CloudWatch Metrics
- Sign-in attempts and success rates
- MFA challenge rates
- Risk score distributions
- Token usage patterns

### Lambda Function Logs
- Pre sign-up validations and rejections
- Post confirmation user creation
- Custom message generation
- Error rates and performance metrics

### Security Events
- Compromised credential detections
- Unusual sign-in patterns
- Device registration events
- MFA setup and usage

## Environment Configuration

### Development Environment
```bash
USER_POOL_ID=us-east-1_dev123456
USER_POOL_CLIENT_ID=1234567890abcdef
IDENTITY_POOL_ID=us-east-1:dev-1234-5678-9012
FRONTEND_URL=http://localhost:5173
TRUSTED_DOMAINS=company.com
CREATE_WELCOME_CAPSULE=true
```

### Production Environment
```bash
USER_POOL_ID=us-east-1_prod123456
USER_POOL_CLIENT_ID=abcdef1234567890
IDENTITY_POOL_ID=us-east-1:prod-1234-5678-9012
FRONTEND_URL=https://app.youtubelearning.com
TRUSTED_DOMAINS=youtubelearning.com
CREATE_WELCOME_CAPSULE=true
```

## Testing

### Unit Tests
- Lambda trigger functions
- Email validation logic
- User profile creation
- Custom attribute handling

### Integration Tests
- End-to-end authentication flows
- Token validation
- AWS service integrations
- Error handling scenarios

### Security Tests
- Password policy enforcement
- MFA functionality
- User isolation verification
- Token expiration handling

## Troubleshooting

### Common Issues

#### User Registration Fails
- Check pre sign-up trigger logs
- Verify email domain is not blocked
- Ensure custom attributes are valid
- Check DynamoDB permissions

#### Email Verification Not Working
- Verify SES configuration (if using custom domain)
- Check custom message trigger logs
- Ensure callback URLs are correct
- Verify email delivery settings

#### Token Issues
- Check token expiration times
- Verify client configuration
- Ensure proper OAuth scopes
- Check Identity Pool role mappings

#### Permission Denied Errors
- Verify IAM role policies
- Check user isolation conditions
- Ensure proper resource ARNs
- Validate token claims

### Debug Tools
- CloudWatch Logs for Lambda triggers
- Cognito User Pool logs
- AWS X-Ray tracing
- Identity Pool role assumption logs

## Future Enhancements

### Planned Features
- Social identity providers (Google, Facebook)
- SAML federation for enterprise
- Custom authentication challenges
- Multi-language message templates
- Advanced user analytics
- Automated security responses

### Scalability Considerations
- User Pool quotas and limits
- Lambda trigger concurrency
- DynamoDB capacity planning
- Identity Pool role session limits

## Cost Optimization

### Current Configuration
- Pay-per-use pricing model
- No SMS MFA (cost savings)
- Efficient Lambda trigger design
- Minimal IAM permissions

### Cost Monitoring
- Monthly Active Users (MAU) tracking
- Lambda invocation costs
- Advanced Security feature costs
- Token refresh patterns