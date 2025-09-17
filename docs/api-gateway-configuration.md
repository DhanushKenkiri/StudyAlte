# API Gateway Configuration

This document describes the comprehensive API Gateway configuration for the YouTube Learning Platform.

## Overview

The API Gateway serves as the main entry point for all client requests to the backend services. It provides:

- **Authentication & Authorization**: Integration with AWS Cognito for secure access
- **Request Validation**: Schema-based validation for all incoming requests
- **Rate Limiting**: Throttling and quota management to prevent abuse
- **CORS Support**: Cross-origin resource sharing for web applications
- **Error Handling**: Standardized error responses across all endpoints
- **Monitoring**: CloudWatch integration for logging and metrics

## API Structure

### Base URL
```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/
```

### Authentication

The API uses AWS Cognito User Pools for authentication. Protected endpoints require:
- `Authorization` header with JWT token from Cognito
- Token must be valid and not expired
- User must have appropriate permissions

#### Public Endpoints
- `GET /health` - Health check (no authentication required)

#### Protected Endpoints
All other endpoints require valid Cognito JWT token.

## Endpoint Categories

### 1. Authentication (`/auth`)
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - User logout
- `POST /auth/forgot-password` - Password reset initiation
- `POST /auth/reset-password` - Password reset completion

### 2. User Management (`/users`)
- `GET /users/{userId}` - Get user profile
- `PUT /users/{userId}` - Update user profile
- `POST /users` - Create user (admin only)
- `DELETE /users/{userId}` - Delete user account

### 3. Video Processing (`/videos`)
- `POST /videos/process` - Process YouTube video
- `GET /videos/{videoId}/status` - Get processing status

### 4. Learning Capsules (`/capsules`)
- `GET /capsules` - List user's capsules
- `POST /capsules` - Create new capsule
- `GET /capsules/{capsuleId}` - Get specific capsule
- `PUT /capsules/{capsuleId}` - Update capsule
- `DELETE /capsules/{capsuleId}` - Delete capsule

#### Capsule Content Sub-resources
- `GET /capsules/{capsuleId}/summary` - Get summary
- `GET /capsules/{capsuleId}/flashcards` - Get flashcards
- `GET /capsules/{capsuleId}/quiz` - Get quiz
- `GET /capsules/{capsuleId}/mindmap` - Get mind map
- `GET /capsules/{capsuleId}/notes` - Get notes
- `GET /capsules/{capsuleId}/transcript` - Get transcript

### 5. Study Sessions (`/study`)
- `POST /study/flashcards` - Start flashcard session
- `POST /study/quiz` - Start quiz session
- `PUT /study/progress` - Update study progress

### 6. AI Tutor (`/tutor`)
- `POST /tutor/chat` - Send message to AI tutor
- `GET /tutor/conversations` - Get conversation history
- `GET /tutor/conversations/{conversationId}` - Get specific conversation

### 7. Search (`/search`)
- `GET /search/capsules` - Search learning capsules
- `GET /search/content` - Search within content

### 8. Analytics (`/analytics`)
- `GET /analytics/progress` - Get progress analytics
- `GET /analytics/performance` - Get performance metrics

### 9. Export (`/export`)
- `POST /export/data` - Export user data
- `GET /export/{exportId}` - Download export file

### 10. Health Check (`/health`)
- `GET /health` - API health status

## Request/Response Format

### Standard Request Headers
```
Content-Type: application/json
Authorization: Bearer {jwt-token}
X-Api-Key: {api-key} (optional, for additional rate limiting)
```

### Standard Response Format

#### Success Response
```json
{
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "uuid"
  }
}
```

#### Error Response
```json
{
  "error": "ValidationError",
  "message": "Invalid request parameters",
  "statusCode": 400,
  "details": {
    "field": "videoUrl",
    "reason": "Invalid YouTube URL format"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "uuid"
  }
}
```

## Rate Limiting

### Default Limits
- **Rate Limit**: 100 requests/second
- **Burst Limit**: 200 requests
- **Monthly Quota**: 100,000 requests

### Endpoint-Specific Limits

#### Video Processing
- **Rate Limit**: 5 requests/second
- **Burst Limit**: 10 requests
- **Reason**: Resource-intensive operations

#### AI Tutor
- **Rate Limit**: 20 requests/second
- **Burst Limit**: 50 requests
- **Reason**: AI API costs and latency

#### Search
- **Rate Limit**: 50 requests/second
- **Burst Limit**: 100 requests
- **Reason**: Database query optimization

## CORS Configuration

### Allowed Origins
- `http://localhost:5173` (development)
- `https://*.amazonaws.com` (production CloudFront)

### Allowed Methods
- `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

### Allowed Headers
- `Content-Type`
- `X-Amz-Date`
- `Authorization`
- `X-Api-Key`
- `X-Amz-Security-Token`
- `X-Amz-User-Agent`

### Exposed Headers
- `X-Request-Id`
- `X-Rate-Limit-Remaining`

## Request Validation

### Schema Validation
All endpoints use JSON Schema for request validation:
- Required fields are enforced
- Data types are validated
- Format validation (email, URL, etc.)
- String length constraints
- Enum value validation

### Example: Video Processing Request
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "options": {
    "generateSummary": true,
    "generateFlashcards": true,
    "generateQuiz": false,
    "generateMindMap": true,
    "generateNotes": true
  }
}
```

## Error Handling

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable (health check failure)

### Error Types
- `ValidationError` - Request validation failed
- `AuthenticationError` - Authentication required or failed
- `AuthorizationError` - Insufficient permissions
- `NotFoundError` - Resource not found
- `RateLimitError` - Rate limit exceeded
- `ProcessingError` - Video processing failed
- `InternalError` - Unexpected server error

## Monitoring and Logging

### CloudWatch Metrics
- Request count by endpoint
- Error rate by status code
- Response latency percentiles
- Rate limit violations
- Authentication failures

### X-Ray Tracing
- End-to-end request tracing
- Lambda function performance
- Database query performance
- External API call latency

### Log Levels
- **Production**: `info` level and above
- **Development**: `debug` level and above

## Security Features

### Authentication
- JWT token validation
- Token expiration checking
- Refresh token rotation

### Authorization
- Resource-based access control
- User can only access their own data
- Admin endpoints require special permissions

### Input Sanitization
- SQL injection prevention
- XSS protection
- Request size limits

### Rate Limiting
- Per-user rate limiting
- IP-based rate limiting
- Endpoint-specific limits

## Deployment Configuration

### Environment Variables
```bash
NODE_ENV=production
DYNAMODB_TABLE_NAME=youtube-learning-platform-prod-main
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
S3_BUCKET_NAME=youtube-learning-platform-prod-content
LOG_LEVEL=info
APP_VERSION=1.0.0
```

### CDK Configuration
The API Gateway is deployed using AWS CDK with:
- Infrastructure as Code
- Environment-specific configurations
- Automated testing
- Blue-green deployments

## Testing

### Unit Tests
- API Gateway resource creation
- Lambda function configuration
- IAM role permissions
- CORS configuration

### Integration Tests
- End-to-end API calls
- Authentication flows
- Error handling
- Rate limiting

### Load Testing
- Performance under load
- Rate limit effectiveness
- Auto-scaling behavior

## Troubleshooting

### Common Issues

#### CORS Errors
- Check allowed origins configuration
- Verify preflight OPTIONS requests
- Ensure proper headers are included

#### Authentication Failures
- Verify JWT token format
- Check token expiration
- Confirm Cognito configuration

#### Rate Limiting
- Monitor CloudWatch metrics
- Adjust usage plan limits
- Implement client-side retry logic

#### Validation Errors
- Check request schema compliance
- Verify required fields
- Validate data types and formats

### Debug Tools
- CloudWatch Logs for detailed error messages
- X-Ray for request tracing
- API Gateway test console
- Postman/curl for manual testing

## Future Enhancements

### Planned Features
- WebSocket support for real-time features
- GraphQL endpoint for flexible queries
- API versioning strategy
- Enhanced caching with CloudFront
- Custom domain with SSL certificate

### Performance Optimizations
- Response caching
- Request/response compression
- Lambda provisioned concurrency
- Database connection pooling