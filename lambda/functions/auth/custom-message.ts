import { CustomMessageTriggerEvent, CustomMessageTriggerResult } from 'aws-lambda';
import { logger } from '../../shared/logger';

/**
 * Custom Message Lambda Trigger
 * 
 * This function customizes the messages sent to users during authentication flows.
 * It can customize:
 * - Email verification messages
 * - Password reset messages
 * - Welcome messages
 * - MFA messages
 */
export async function handler(
  event: CustomMessageTriggerEvent
): Promise<CustomMessageTriggerResult> {
  logger.info('Custom message trigger invoked', {
    userPoolId: event.userPoolId,
    userName: event.userName,
    triggerSource: event.triggerSource,
    userAttributes: event.request.userAttributes,
  });

  try {
    const { triggerSource, userAttributes, codeParameter } = event.request;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const userName = userAttributes.given_name || userAttributes.email?.split('@')[0] || 'there';

    switch (triggerSource) {
      case 'CustomMessage_SignUp':
        // Email verification during sign-up
        event.response.emailSubject = 'Welcome to YouTube Learning Platform - Verify Your Email';
        event.response.emailMessage = createEmailVerificationMessage(userName, codeParameter, frontendUrl);
        break;

      case 'CustomMessage_ResendCode':
        // Resend verification code
        event.response.emailSubject = 'YouTube Learning Platform - Verification Code';
        event.response.emailMessage = createResendCodeMessage(userName, codeParameter, frontendUrl);
        break;

      case 'CustomMessage_ForgotPassword':
        // Password reset
        event.response.emailSubject = 'YouTube Learning Platform - Reset Your Password';
        event.response.emailMessage = createPasswordResetMessage(userName, codeParameter, frontendUrl);
        break;

      case 'CustomMessage_UpdateUserAttribute':
        // Email change verification
        event.response.emailSubject = 'YouTube Learning Platform - Verify New Email';
        event.response.emailMessage = createEmailChangeMessage(userName, codeParameter, frontendUrl);
        break;

      case 'CustomMessage_VerifyUserAttribute':
        // Verify user attribute (email/phone)
        event.response.emailSubject = 'YouTube Learning Platform - Verify Your Information';
        event.response.emailMessage = createAttributeVerificationMessage(userName, codeParameter, frontendUrl);
        break;

      case 'CustomMessage_Authentication':
        // MFA authentication
        event.response.smsMessage = `Your YouTube Learning Platform verification code is ${codeParameter}`;
        event.response.emailSubject = 'YouTube Learning Platform - Authentication Code';
        event.response.emailMessage = createMFAMessage(userName, codeParameter);
        break;

      default:
        logger.warn('Unknown trigger source', { triggerSource });
        // Use default messages
        break;
    }

    logger.info('Custom message generated successfully', {
      triggerSource,
      userName: event.userName,
      hasEmailMessage: !!event.response.emailMessage,
      hasSmsMessage: !!event.response.smsMessage,
    });

    return event.response;
  } catch (error) {
    logger.error('Failed to generate custom message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      triggerSource: event.request.triggerSource,
      userName: event.userName,
    });

    // Return default response on error
    return event.response;
  }
}

function createEmailVerificationMessage(userName: string, code: string, frontendUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to YouTube Learning Platform</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code { background: #fff; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #667eea; margin: 20px 0; border-radius: 5px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎓 Welcome to YouTube Learning Platform!</h1>
        <p>Transform YouTube videos into interactive learning experiences</p>
    </div>
    <div class="content">
        <h2>Hi ${userName}!</h2>
        <p>Thank you for joining YouTube Learning Platform! We're excited to help you supercharge your learning journey.</p>
        
        <p>To complete your registration, please verify your email address using the code below:</p>
        
        <div class="code">${code}</div>
        
        <p>Or click this button to verify automatically:</p>
        <a href="${frontendUrl}/auth/verify?code=${code}" class="button">Verify Email Address</a>
        
        <p><strong>What you can do with YouTube Learning Platform:</strong></p>
        <ul>
            <li>🎥 Convert YouTube videos into structured learning materials</li>
            <li>📚 Generate AI-powered flashcards and quizzes</li>
            <li>🧠 Create interactive mind maps from video content</li>
            <li>🤖 Chat with an AI tutor about your learning materials</li>
            <li>📊 Track your learning progress and achievements</li>
        </ul>
        
        <p>This verification code will expire in 24 hours. If you didn't create this account, please ignore this email.</p>
    </div>
    <div class="footer">
        <p>Happy Learning!<br>The YouTube Learning Platform Team</p>
        <p><small>If you have any questions, reply to this email or visit our help center.</small></p>
    </div>
</body>
</html>
  `.trim();
}

function createResendCodeMessage(userName: string, code: string, frontendUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Verification Code - YouTube Learning Platform</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code { background: #fff; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #667eea; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 Verification Code</h1>
    </div>
    <div class="content">
        <h2>Hi ${userName}!</h2>
        <p>Here's your new verification code for YouTube Learning Platform:</p>
        
        <div class="code">${code}</div>
        
        <p>Enter this code to complete your email verification. This code will expire in 24 hours.</p>
        
        <p>If you didn't request this code, please ignore this email.</p>
    </div>
</body>
</html>
  `.trim();
}

function createPasswordResetMessage(userName: string, code: string, frontendUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reset Your Password - YouTube Learning Platform</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e74c3c; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code { background: #fff; border: 2px dashed #e74c3c; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #e74c3c; margin: 20px 0; border-radius: 5px; }
        .button { display: inline-block; background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Password Reset Request</h1>
    </div>
    <div class="content">
        <h2>Hi ${userName}!</h2>
        <p>We received a request to reset your password for your YouTube Learning Platform account.</p>
        
        <p>Use this verification code to reset your password:</p>
        
        <div class="code">${code}</div>
        
        <p>Or click this button to reset your password directly:</p>
        <a href="${frontendUrl}/auth/reset-password?code=${code}" class="button">Reset Password</a>
        
        <div class="warning">
            <strong>⚠️ Security Notice:</strong> This code will expire in 1 hour. If you didn't request this password reset, please ignore this email and consider changing your password as a precaution.
        </div>
        
        <p>For your security, never share this code with anyone.</p>
    </div>
</body>
</html>
  `.trim();
}

function createEmailChangeMessage(userName: string, code: string, frontendUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Verify New Email - YouTube Learning Platform</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f39c12; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code { background: #fff; border: 2px dashed #f39c12; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #f39c12; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📧 Verify New Email Address</h1>
    </div>
    <div class="content">
        <h2>Hi ${userName}!</h2>
        <p>You've requested to change your email address for your YouTube Learning Platform account.</p>
        
        <p>Please verify this new email address using the code below:</p>
        
        <div class="code">${code}</div>
        
        <p>This code will expire in 24 hours. If you didn't request this change, please contact our support team immediately.</p>
    </div>
</body>
</html>
  `.trim();
}

function createAttributeVerificationMessage(userName: string, code: string, frontendUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Verify Information - YouTube Learning Platform</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #9b59b6; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code { background: #fff; border: 2px dashed #9b59b6; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #9b59b6; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>✅ Verify Your Information</h1>
    </div>
    <div class="content">
        <h2>Hi ${userName}!</h2>
        <p>Please verify your information for your YouTube Learning Platform account.</p>
        
        <p>Use this verification code:</p>
        
        <div class="code">${code}</div>
        
        <p>This code will expire in 24 hours.</p>
    </div>
</body>
</html>
  `.trim();
}

function createMFAMessage(userName: string, code: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Authentication Code - YouTube Learning Platform</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code { background: #fff; border: 2px dashed #2c3e50; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #2c3e50; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 Authentication Required</h1>
    </div>
    <div class="content">
        <h2>Hi ${userName}!</h2>
        <p>Someone is trying to sign in to your YouTube Learning Platform account.</p>
        
        <p>If this is you, use this authentication code:</p>
        
        <div class="code">${code}</div>
        
        <p>This code will expire in 5 minutes. If this wasn't you, please secure your account immediately.</p>
    </div>
</body>
</html>
  `.trim();
}