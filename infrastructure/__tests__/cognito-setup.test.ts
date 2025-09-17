import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { YoutubeLearningPlatformStack } from '../youtube-learning-platform-stack';

describe('Cognito Setup', () => {
  let template: Template;
  let stack: YoutubeLearningPlatformStack;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new YoutubeLearningPlatformStack(app, 'TestStack', {
      environment: 'test',
      stackName: 'youtube-learning-platform',
    });
    template = Template.fromStack(stack);
  });

  describe('User Pool Configuration', () => {
    test('should create user pool with correct settings', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: 'youtube-learning-platform-test-users',
        Policies: {
          PasswordPolicy: {
            MinimumLength: 8,
            RequireLowercase: true,
            RequireNumbers: true,
            RequireSymbols: true,
            RequireUppercase: true,
            TemporaryPasswordValidityDays: 7,
          },
        },
        AutoVerifiedAttributes: ['email'],
        UsernameAttributes: ['email'],
        MfaConfiguration: 'OPTIONAL',
        EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
        UserPoolAddOns: {
          AdvancedSecurityMode: 'ENFORCED',
        },
        DeviceConfiguration: {
          ChallengeRequiredOnNewDevice: true,
          DeviceOnlyRememberedOnUserPrompt: false,
        },
      });
    });

    test('should configure standard attributes', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Schema: [
          {
            AttributeDataType: 'String',
            Name: 'email',
            Required: true,
            Mutable: true,
          },
          {
            AttributeDataType: 'String',
            Name: 'given_name',
            Required: true,
            Mutable: true,
          },
          {
            AttributeDataType: 'String',
            Name: 'family_name',
            Required: false,
            Mutable: true,
          },
          {
            AttributeDataType: 'String',
            Name: 'preferred_username',
            Required: false,
            Mutable: true,
          },
        ],
      });
    });

    test('should configure custom attributes', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Schema: [
          {
            AttributeDataType: 'String',
            Name: 'learning_preferences',
            Mutable: true,
            StringAttributeConstraints: {
              MinLength: '0',
              MaxLength: '2048',
            },
          },
          {
            AttributeDataType: 'String',
            Name: 'subscription_tier',
            Mutable: true,
            StringAttributeConstraints: {
              MinLength: '0',
              MaxLength: '50',
            },
          },
          {
            AttributeDataType: 'Boolean',
            Name: 'onboarding_completed',
            Mutable: true,
          },
        ],
      });
    });

    test('should configure Lambda triggers', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        LambdaConfig: {
          PreSignUp: {
            'Fn::GetAtt': [
              'PreSignUpTrigger',
              'Arn',
            ],
          },
          PostConfirmation: {
            'Fn::GetAtt': [
              'PostConfirmationTrigger',
              'Arn',
            ],
          },
          CustomMessage: {
            'Fn::GetAtt': [
              'CustomMessageTrigger',
              'Arn',
            ],
          },
        },
      });
    });
  });

  describe('User Pool Clients', () => {
    test('should create web client with correct settings', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ClientName: 'youtube-learning-platform-test-web-client',
        GenerateSecret: false,
        ExplicitAuthFlows: ['ALLOW_USER_SRP_AUTH'],
        SupportedIdentityProviders: ['COGNITO'],
        AllowedOAuthFlows: ['code'],
        AllowedOAuthScopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
        CallbackURLs: [
          'http://localhost:5173/auth/callback',
          'https://app.youtubelearning.com/auth/callback',
        ],
        LogoutURLs: [
          'http://localhost:5173/auth/logout',
          'https://app.youtubelearning.com/auth/logout',
        ],
        RefreshTokenValidity: 30,
        AccessTokenValidity: 60,
        IdTokenValidity: 60,
        TokenValidityUnits: {
          RefreshToken: 'days',
          AccessToken: 'minutes',
          IdToken: 'minutes',
        },
        EnableTokenRevocation: true,
        PreventUserExistenceErrors: 'ENABLED',
      });
    });

    test('should create mobile client with correct settings', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ClientName: 'youtube-learning-platform-test-mobile-client',
        GenerateSecret: false,
        ExplicitAuthFlows: ['ALLOW_USER_SRP_AUTH'],
        SupportedIdentityProviders: ['COGNITO'],
        RefreshTokenValidity: 30,
        AccessTokenValidity: 60,
        IdTokenValidity: 60,
        EnableTokenRevocation: true,
        PreventUserExistenceErrors: 'ENABLED',
      });
    });

    test('should configure read and write attributes', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ReadAttributes: [
          'email',
          'email_verified',
          'given_name',
          'family_name',
          'preferred_username',
          'custom:learning_preferences',
          'custom:subscription_tier',
          'custom:onboarding_completed',
        ],
        WriteAttributes: [
          'email',
          'given_name',
          'family_name',
          'preferred_username',
          'custom:learning_preferences',
          'custom:subscription_tier',
          'custom:onboarding_completed',
        ],
      });
    });
  });

  describe('Identity Pool', () => {
    test('should create identity pool with correct settings', () => {
      template.hasResourceProperties('AWS::Cognito::IdentityPool', {
        IdentityPoolName: 'youtube-learning-platform-test-identity',
        AllowUnauthenticatedIdentities: false,
        CognitoIdentityProviders: [
          {
            ServerSideTokenCheck: true,
          },
          {
            ServerSideTokenCheck: true,
          },
        ],
      });
    });

    test('should create role attachment', () => {
      template.hasResourceProperties('AWS::Cognito::IdentityPoolRoleAttachment', {
        Roles: {
          authenticated: {
            'Fn::GetAtt': ['AuthenticatedRole', 'Arn'],
          },
          unauthenticated: {
            'Fn::GetAtt': ['UnauthenticatedRole', 'Arn'],
          },
        },
        RoleMappings: {
          'cognito-idp': {
            Type: 'Token',
            AmbiguousRoleResolution: 'AuthenticatedRole',
          },
        },
      });
    });
  });

  describe('IAM Roles', () => {
    test('should create authenticated role with correct permissions', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Federated: 'cognito-identity.amazonaws.com',
              },
              Action: 'sts:AssumeRoleWithWebIdentity',
              Condition: {
                StringEquals: {
                  'cognito-identity.amazonaws.com:aud': {
                    Ref: 'IdentityPool',
                  },
                },
                'ForAnyValue:StringLike': {
                  'cognito-identity.amazonaws.com:amr': 'authenticated',
                },
              },
            },
          ],
        },
      });
    });

    test('should grant DynamoDB access with user isolation', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        Policies: [
          {
            PolicyName: 'DynamoDBUserDataAccess',
            PolicyDocument: {
              Statement: [
                {
                  Effect: 'Allow',
                  Action: [
                    'dynamodb:GetItem',
                    'dynamodb:PutItem',
                    'dynamodb:UpdateItem',
                    'dynamodb:DeleteItem',
                    'dynamodb:Query',
                  ],
                  Condition: {
                    'ForAllValues:StringEquals': {
                      'dynamodb:LeadingKeys': ['${cognito-identity.amazonaws.com:sub}'],
                    },
                  },
                },
              ],
            },
          },
        ],
      });
    });

    test('should grant S3 access with user isolation', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        Policies: [
          {
            PolicyName: 'S3UserContentAccess',
            PolicyDocument: {
              Statement: [
                {
                  Effect: 'Allow',
                  Action: [
                    's3:GetObject',
                    's3:PutObject',
                    's3:DeleteObject',
                  ],
                  Resource: {
                    'Fn::Join': [
                      '',
                      [
                        {
                          'Fn::GetAtt': ['ContentBucket', 'Arn'],
                        },
                        '/users/${cognito-identity.amazonaws.com:sub}/*',
                      ],
                    ],
                  },
                },
                {
                  Effect: 'Allow',
                  Action: ['s3:ListBucket'],
                  Condition: {
                    StringLike: {
                      's3:prefix': ['users/${cognito-identity.amazonaws.com:sub}/*'],
                    },
                  },
                },
              ],
            },
          },
        ],
      });
    });

    test('should create unauthenticated role with minimal permissions', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Federated: 'cognito-identity.amazonaws.com',
              },
              Action: 'sts:AssumeRoleWithWebIdentity',
              Condition: {
                StringEquals: {
                  'cognito-identity.amazonaws.com:aud': {
                    Ref: 'IdentityPool',
                  },
                },
                'ForAnyValue:StringLike': {
                  'cognito-identity.amazonaws.com:amr': 'unauthenticated',
                },
              },
            },
          ],
        },
        Policies: [
          {
            PolicyName: 'CognitoIdentityPolicy',
            PolicyDocument: {
              Statement: [
                {
                  Effect: 'Allow',
                  Action: ['cognito-identity:GetId'],
                  Resource: '*',
                },
              ],
            },
          },
        ],
      });
    });
  });

  describe('Lambda Triggers', () => {
    test('should create pre-signup trigger function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'youtube-learning-platform-test-pre-signup',
        Handler: 'pre-signup.handler',
        Runtime: 'nodejs20.x',
        Timeout: 10,
        MemorySize: 128,
        TracingConfig: {
          Mode: 'Active',
        },
      });
    });

    test('should create post-confirmation trigger function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'youtube-learning-platform-test-post-confirmation',
        Handler: 'post-confirmation.handler',
        Runtime: 'nodejs20.x',
        Timeout: 30,
        MemorySize: 256,
        TracingConfig: {
          Mode: 'Active',
        },
      });
    });

    test('should create custom message trigger function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'youtube-learning-platform-test-custom-message',
        Handler: 'custom-message.handler',
        Runtime: 'nodejs20.x',
        Timeout: 10,
        MemorySize: 128,
        TracingConfig: {
          Mode: 'Active',
        },
      });
    });

    test('should grant Lambda permissions to Cognito', () => {
      template.hasResourceProperties('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        Principal: 'cognito-idp.amazonaws.com',
      });
    });

    test('should grant DynamoDB permissions to post-confirmation trigger', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                'dynamodb:BatchGetItem',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:Query',
                'dynamodb:GetItem',
                'dynamodb:Scan',
                'dynamodb:ConditionCheckItem',
                'dynamodb:BatchWriteItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:DescribeTable',
              ],
            },
          ],
        },
      });
    });
  });

  describe('Security Configuration', () => {
    test('should enable advanced security mode', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolAddOns: {
          AdvancedSecurityMode: 'ENFORCED',
        },
      });
    });

    test('should configure device tracking', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        DeviceConfiguration: {
          ChallengeRequiredOnNewDevice: true,
          DeviceOnlyRememberedOnUserPrompt: false,
        },
      });
    });

    test('should enable MFA with TOTP', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        MfaConfiguration: 'OPTIONAL',
        EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
      });
    });

    test('should prevent user existence errors', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        PreventUserExistenceErrors: 'ENABLED',
      });
    });

    test('should enable token revocation', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        EnableTokenRevocation: true,
      });
    });
  });

  describe('Outputs', () => {
    test('should output user pool information', () => {
      template.hasOutput('UserPoolId', {
        Description: 'Cognito User Pool ID',
      });

      template.hasOutput('UserPoolClientId', {
        Description: 'Cognito User Pool Client ID (Web)',
      });

      template.hasOutput('MobileUserPoolClientId', {
        Description: 'Cognito User Pool Client ID (Mobile)',
      });

      template.hasOutput('IdentityPoolId', {
        Description: 'Cognito Identity Pool ID',
      });

      template.hasOutput('UserPoolDomain', {
        Description: 'Cognito User Pool Domain',
      });
    });
  });
});