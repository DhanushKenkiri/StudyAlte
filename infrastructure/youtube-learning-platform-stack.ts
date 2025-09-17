import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface YoutubeLearningPlatformStackProps extends cdk.StackProps {
  environment: string;
  stackName: string;
}

export class YoutubeLearningPlatformStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly api: apigateway.RestApi;
  public readonly mainTable: dynamodb.Table;
  public readonly contentBucket: s3.Bucket;
  public readonly searchDomain: opensearch.Domain;

  constructor(scope: Construct, id: string, props: YoutubeLearningPlatformStackProps) {
    super(scope, id, props);

    // DynamoDB Table for all data (single-table design)
    this.mainTable = new dynamodb.Table(this, 'MainTable', {
      tableName: `${props.stackName}-${props.environment}-main`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Global Secondary Indexes
    this.mainTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    this.mainTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
    });

    // S3 Bucket for content storage
    this.contentBucket = new s3.Bucket(this, 'ContentBucket', {
      bucketName: `${props.stackName.toLowerCase()}-${props.environment}-content`,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // OpenSearch Domain for content search
    this.searchDomain = new opensearch.Domain(this, 'SearchDomain', {
      domainName: `${props.stackName.toLowerCase()}-${props.environment}-search`,
      version: opensearch.EngineVersion.OPENSEARCH_2_5,
      capacity: {
        masterNodes: props.environment === 'prod' ? 3 : 1,
        masterNodeInstanceType: props.environment === 'prod' ? 'r6g.medium.search' : 't3.small.search',
        dataNodes: props.environment === 'prod' ? 3 : 1,
        dataNodeInstanceType: props.environment === 'prod' ? 'r6g.large.search' : 't3.small.search',
      },
      ebs: {
        volumeSize: props.environment === 'prod' ? 100 : 20,
        volumeType: ec2.EbsDeviceVolumeType.GP3,
      },
      zoneAwareness: {
        enabled: props.environment === 'prod',
        availabilityZoneCount: props.environment === 'prod' ? 3 : 1,
      },
      logging: {
        slowSearchLogEnabled: true,
        appLogEnabled: true,
        slowIndexLogEnabled: true,
      },
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      enforceHttps: true,
      accessPolicies: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          principals: [new iam.AnyPrincipal()],
          actions: ['es:*'],
          resources: [`arn:aws:es:${this.region}:${this.account}:domain/${props.stackName.toLowerCase()}-${props.environment}-search/*`],
          conditions: {
            IpAddress: {
              'aws:sourceIp': ['0.0.0.0/0'], // This will be restricted later with proper security
            },
          },
        }),
      ],
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Lambda functions for Cognito triggers
    const preSignUpTrigger = new lambda.Function(this, 'PreSignUpTrigger', {
      functionName: `${props.stackName}-${props.environment}-pre-signup`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'pre-signup.handler',
      code: lambda.Code.fromAsset('lambda/functions/auth'),
      environment: {
        NODE_ENV: props.environment,
        LOG_LEVEL: props.environment === 'prod' ? 'info' : 'debug',
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: props.environment === 'prod' ? 30 : 7,
    });

    const postConfirmationTrigger = new lambda.Function(this, 'PostConfirmationTrigger', {
      functionName: `${props.stackName}-${props.environment}-post-confirmation`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'post-confirmation.handler',
      code: lambda.Code.fromAsset('lambda/functions/auth'),
      environment: {
        NODE_ENV: props.environment,
        DYNAMODB_TABLE_NAME: this.mainTable.tableName,
        LOG_LEVEL: props.environment === 'prod' ? 'info' : 'debug',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: props.environment === 'prod' ? 30 : 7,
    });

    const customMessageTrigger = new lambda.Function(this, 'CustomMessageTrigger', {
      functionName: `${props.stackName}-${props.environment}-custom-message`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'custom-message.handler',
      code: lambda.Code.fromAsset('lambda/functions/auth'),
      environment: {
        NODE_ENV: props.environment,
        FRONTEND_URL: props.environment === 'prod' ? 'https://app.youtubelearning.com' : 'http://localhost:5173',
        LOG_LEVEL: props.environment === 'prod' ? 'info' : 'debug',
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: props.environment === 'prod' ? 30 : 7,
    });

    // Grant DynamoDB permissions to post-confirmation trigger
    this.mainTable.grantWriteData(postConfirmationTrigger);

    // Cognito User Pool with enhanced configuration
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${props.stackName}-${props.environment}-users`,
      selfSignUpEnabled: true,
      signInAliases: { 
        email: true,
        username: false,
        phone: false,
      },
      autoVerify: { 
        email: true,
        phone: false,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
        preferredUsername: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        'learning_preferences': new cognito.StringAttribute({ 
          minLen: 0, 
          maxLen: 2048,
          mutable: true,
        }),
        'subscription_tier': new cognito.StringAttribute({ 
          minLen: 0, 
          maxLen: 50,
          mutable: true,
        }),
        'onboarding_completed': new cognito.BooleanAttribute({
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      userVerification: {
        emailSubject: 'Welcome to YouTube Learning Platform - Verify your email',
        emailBody: 'Thank you for signing up to YouTube Learning Platform! Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      userInvitation: {
        emailSubject: 'Welcome to YouTube Learning Platform',
        emailBody: 'Hello {username}, you have been invited to join YouTube Learning Platform. Your temporary password is {####}',
      },
      lambdaTriggers: {
        preSignUp: preSignUpTrigger,
        postConfirmation: postConfirmationTrigger,
        customMessage: customMessageTrigger,
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: false,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      removalPolicy: props.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Cognito User Pool Client with enhanced security
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${props.stackName}-${props.environment}-web-client`,
      generateSecret: false, // Web clients don't use secrets
      authFlows: {
        userSrp: true, // Secure Remote Password protocol
        userPassword: false, // Disable admin auth flow for security
        adminUserPassword: false, // Disable admin-initiated auth
        custom: false, // Disable custom auth flow
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false, // Disable implicit flow for security
          clientCredentials: false,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.COGNITO_ADMIN,
        ],
        callbackUrls: [
          'http://localhost:5173/auth/callback',
          'https://app.youtubelearning.com/auth/callback',
        ],
        logoutUrls: [
          'http://localhost:5173/auth/logout',
          'https://app.youtubelearning.com/auth/logout',
        ],
      },
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      enableTokenRevocation: true,
      preventUserExistenceErrors: true,
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          emailVerified: true,
          givenName: true,
          familyName: true,
          preferredUsername: true,
        })
        .withCustomAttributes('learning_preferences', 'subscription_tier', 'onboarding_completed'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          givenName: true,
          familyName: true,
          preferredUsername: true,
        })
        .withCustomAttributes('learning_preferences', 'subscription_tier', 'onboarding_completed'),
    });

    // Additional client for mobile/native apps (with different settings)
    const mobileUserPoolClient = new cognito.UserPoolClient(this, 'MobileUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${props.stackName}-${props.environment}-mobile-client`,
      generateSecret: false,
      authFlows: {
        userSrp: true,
        userPassword: false,
        adminUserPassword: false,
        custom: false,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      enableTokenRevocation: true,
      preventUserExistenceErrors: true,
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          emailVerified: true,
          givenName: true,
          familyName: true,
          preferredUsername: true,
        })
        .withCustomAttributes('learning_preferences', 'subscription_tier', 'onboarding_completed'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          givenName: true,
          familyName: true,
          preferredUsername: true,
        })
        .withCustomAttributes('learning_preferences', 'subscription_tier', 'onboarding_completed'),
    });

    // Cognito Identity Pool
    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `${props.stackName}-${props.environment}-identity`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: true,
        },
        {
          clientId: mobileUserPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: true,
        },
      ],
    });

    // IAM Roles for Identity Pool
    const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      inlinePolicies: {
        CognitoIdentityPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cognito-identity:GetCredentialsForIdentity',
                'cognito-identity:GetId',
              ],
              resources: ['*'],
            }),
          ],
        }),
        DynamoDBUserDataAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
              ],
              resources: [
                this.mainTable.tableArn,
                `${this.mainTable.tableArn}/index/*`,
              ],
              conditions: {
                'ForAllValues:StringEquals': {
                  'dynamodb:LeadingKeys': ['${cognito-identity.amazonaws.com:sub}'],
                },
              },
            }),
          ],
        }),
        S3UserContentAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [`${this.contentBucket.bucketArn}/users/\${cognito-identity.amazonaws.com:sub}/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:ListBucket',
              ],
              resources: [this.contentBucket.bucketArn],
              conditions: {
                StringLike: {
                  's3:prefix': ['users/${cognito-identity.amazonaws.com:sub}/*'],
                },
              },
            }),
          ],
        }),
      },
    });

    const unauthenticatedRole = new iam.Role(this, 'UnauthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      inlinePolicies: {
        CognitoIdentityPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cognito-identity:GetId',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Attach roles to Identity Pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
        unauthenticated: unauthenticatedRole.roleArn,
      },
      roleMappings: {
        'cognito-idp': {
          type: 'Token',
          ambiguousRoleResolution: 'AuthenticatedRole',
          identityProvider: `cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}:${this.userPoolClient.userPoolClientId}`,
        },
      },
    });

    // API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${props.stackName}-${props.environment}-api`,
      description: 'YouTube Learning Platform API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // Lambda Layer for shared dependencies
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      layerVersionName: `${props.stackName}-${props.environment}-shared`,
      code: lambda.Code.fromAsset('lambda-layers/shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X, lambda.Runtime.NODEJS_20_X],
      description: 'Shared dependencies for Lambda functions',
    });

    // Lambda execution role with necessary permissions
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:BatchGetItem',
                'dynamodb:BatchWriteItem',
                'dynamodb:TransactGetItems',
                'dynamodb:TransactWriteItems',
              ],
              resources: [
                this.mainTable.tableArn,
                `${this.mainTable.tableArn}/index/*`,
              ],
            }),
          ],
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [`${this.contentBucket.bucketArn}/*`],
            }),
          ],
        }),
        CloudWatchAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudwatch:PutMetricData',
              ],
              resources: ['*'],
            }),
          ],
        }),
        OpenSearchAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'es:ESHttpDelete',
                'es:ESHttpGet',
                'es:ESHttpHead',
                'es:ESHttpPost',
                'es:ESHttpPut',
                'es:ESHttpPatch',
              ],
              resources: [this.searchDomain.domainArn, `${this.searchDomain.domainArn}/*`],
            }),
          ],
        }),
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
              resources: [
                'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0',
                'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0',
                'arn:aws:bedrock:*::foundation-model/anthropic.claude-instant-v1',
              ],
            }),
          ],
        }),
      },
    });

    // Common Lambda environment variables
    const commonLambdaEnvironment = {
      NODE_ENV: props.environment,
      DYNAMODB_TABLE_NAME: this.mainTable.tableName,
      COGNITO_USER_POOL_ID: this.userPool.userPoolId,
      COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
      S3_BUCKET_NAME: this.contentBucket.bucketName,
      OPENSEARCH_DOMAIN_ENDPOINT: this.searchDomain.domainEndpoint,
      LOG_LEVEL: props.environment === 'prod' ? 'info' : 'debug',
    };

    // Lambda Functions

    // Health Check Lambda (public endpoint)
    const healthCheckFunction = new lambda.Function(this, 'HealthCheckFunction', {
      functionName: `${props.stackName}-${props.environment}-health-check`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'health-check.handler',
      code: lambda.Code.fromAsset('lambda/functions/health'),
      layers: [sharedLayer],
      role: lambdaExecutionRole,
      environment: {
        ...commonLambdaEnvironment,
        APP_VERSION: '1.0.0',
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: props.environment === 'prod' ? 30 : 7, // days
    });

    // Users API Lambda
    const getUserProfileFunction = new lambda.Function(this, 'GetUserProfileFunction', {
      functionName: `${props.stackName}-${props.environment}-get-user-profile`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-profile.handler',
      code: lambda.Code.fromAsset('lambda/functions/users'),
      layers: [sharedLayer],
      role: lambdaExecutionRole,
      environment: commonLambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: props.environment === 'prod' ? 30 : 7, // days
    });

    // Search Infrastructure Lambda Functions
    
    // Setup Search Infrastructure Lambda
    const setupSearchInfrastructureFunction = new lambda.Function(this, 'SetupSearchInfrastructureFunction', {
      functionName: `${props.stackName}-${props.environment}-setup-search-infrastructure`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'setup-search-infrastructure.handler',
      code: lambda.Code.fromAsset('lambda/functions/search'),
      layers: [sharedLayer],
      role: lambdaExecutionRole,
      environment: commonLambdaEnvironment,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: props.environment === 'prod' ? 30 : 7,
    });

    // Index Content Lambda
    const indexContentFunction = new lambda.Function(this, 'IndexContentFunction', {
      functionName: `${props.stackName}-${props.environment}-index-content`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index-content.handler',
      code: lambda.Code.fromAsset('lambda/functions/search'),
      layers: [sharedLayer],
      role: lambdaExecutionRole,
      environment: commonLambdaEnvironment,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: props.environment === 'prod' ? 30 : 7,
    });

    // Search Notes Lambda
    const searchNotesFunction = new lambda.Function(this, 'SearchNotesFunction', {
      functionName: `${props.stackName}-${props.environment}-search-notes`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'search-notes.handler',
      code: lambda.Code.fromAsset('lambda/functions/notes'),
      layers: [sharedLayer],
      role: lambdaExecutionRole,
      environment: commonLambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: props.environment === 'prod' ? 30 : 7,
    });

    // Global Search Lambda
    const globalSearchFunction = new lambda.Function(this, 'GlobalSearchFunction', {
      functionName: `${props.stackName}-${props.environment}-global-search`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'global-search.handler',
      code: lambda.Code.fromAsset('lambda/functions/search'),
      layers: [sharedLayer],
      role: lambdaExecutionRole,
      environment: commonLambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: props.environment === 'prod' ? 30 : 7,
    });

    // Tagging System Lambda Functions
    
    // Generate Tags Lambda
    const generateTagsFunction = new lambda.Function(this, 'GenerateTagsFunction', {
      functionName: `${props.stackName}-${props.environment}-generate-tags`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'generate-tags.handler',
      code: lambda.Code.fromAsset('lambda/functions/videos'),
      layers: [sharedLayer],
      role: lambdaExecutionRole,
      environment: commonLambdaEnvironment,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: props.environment === 'prod' ? 30 : 7,
    });

    // Manage Tags Lambda
    const manageTagsFunction = new lambda.Function(this, 'ManageTagsFunction', {
      functionName: `${props.stackName}-${props.environment}-manage-tags`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'manage-tags.handler',
      code: lambda.Code.fromAsset('lambda/functions/videos'),
      layers: [sharedLayer],
      role: lambdaExecutionRole,
      environment: commonLambdaEnvironment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: props.environment === 'prod' ? 30 : 7,
    });

    // Cognito Authorizer for protected endpoints
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [this.userPool],
      authorizerName: `${props.stackName}-${props.environment}-authorizer`,
    });

    // Request validators
    const requestValidator = new apigateway.RequestValidator(this, 'RequestValidator', {
      restApi: this.api,
      requestValidatorName: `${props.stackName}-${props.environment}-validator`,
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    // API Gateway Models for request/response validation
    const userModel = this.api.addModel('UserModel', {
      contentType: 'application/json',
      modelName: 'User',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'User',
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          id: { type: apigateway.JsonSchemaType.STRING },
          email: { type: apigateway.JsonSchemaType.STRING },
          name: { type: apigateway.JsonSchemaType.STRING },
          preferences: { type: apigateway.JsonSchemaType.OBJECT },
        },
        required: ['email', 'name'],
      },
    });

    const capsuleModel = this.api.addModel('CapsuleModel', {
      contentType: 'application/json',
      modelName: 'LearningCapsule',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'LearningCapsule',
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          id: { type: apigateway.JsonSchemaType.STRING },
          videoUrl: { type: apigateway.JsonSchemaType.STRING },
          title: { type: apigateway.JsonSchemaType.STRING },
          summary: { type: apigateway.JsonSchemaType.STRING },
          flashcards: { type: apigateway.JsonSchemaType.ARRAY },
          quiz: { type: apigateway.JsonSchemaType.OBJECT },
          mindMap: { type: apigateway.JsonSchemaType.OBJECT },
          notes: { type: apigateway.JsonSchemaType.ARRAY },
        },
        required: ['videoUrl'],
      },
    });

    // Error response model
    const errorModel = this.api.addModel('ErrorModel', {
      contentType: 'application/json',
      modelName: 'Error',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'Error',
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          error: { type: apigateway.JsonSchemaType.STRING },
          message: { type: apigateway.JsonSchemaType.STRING },
          statusCode: { type: apigateway.JsonSchemaType.NUMBER },
        },
        required: ['error', 'message', 'statusCode'],
      },
    });

    // Common method options for protected endpoints
    const protectedMethodOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: cognitoAuthorizer,
      requestValidator,
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorModel,
          },
        },
        {
          statusCode: '401',
          responseModels: {
            'application/json': errorModel,
          },
        },
        {
          statusCode: '403',
          responseModels: {
            'application/json': errorModel,
          },
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': errorModel,
          },
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': errorModel,
          },
        },
      ],
    };

    // Public method options (no auth required)
    const publicMethodOptions: apigateway.MethodOptions = {
      authorizationType: apigateway.AuthorizationType.NONE,
      requestValidator,
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorModel,
          },
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': errorModel,
          },
        },
      ],
    };

    // API Gateway Resources and Methods

    // 1. Users API
    const usersResource = this.api.root.addResource('users');
    
    // GET /users/{userId} - Get user profile
    const userResource = usersResource.addResource('{userId}');
    userResource.addMethod('GET', new apigateway.LambdaIntegration(getUserProfileFunction), protectedMethodOptions);
    
    // PUT /users/{userId} - Update user profile
    // POST /users - Create user profile
    // DELETE /users/{userId} - Delete user profile

    // 2. Authentication API
    const authResource = this.api.root.addResource('auth');
    
    // POST /auth/login - User login (handled by Cognito)
    // POST /auth/register - User registration (handled by Cognito)
    // POST /auth/refresh - Refresh token (handled by Cognito)
    // POST /auth/logout - User logout
    // POST /auth/forgot-password - Forgot password
    // POST /auth/reset-password - Reset password

    // 3. Video Processing API
    const videosResource = this.api.root.addResource('videos');
    
    // POST /videos/process - Process YouTube video
    const processResource = videosResource.addResource('process');
    
    // GET /videos/{videoId}/status - Get processing status
    const videoResource = videosResource.addResource('{videoId}');
    const statusResource = videoResource.addResource('status');

    // 4. Learning Capsules API
    const capsulesResource = this.api.root.addResource('capsules');
    
    // GET /capsules - List user's capsules
    // POST /capsules - Create new capsule
    // GET /capsules/{capsuleId} - Get specific capsule
    const capsuleResource = capsulesResource.addResource('{capsuleId}');
    
    // PUT /capsules/{capsuleId} - Update capsule
    // DELETE /capsules/{capsuleId} - Delete capsule
    
    // GET /capsules/{capsuleId}/summary - Get capsule summary
    const summaryResource = capsuleResource.addResource('summary');
    
    // GET /capsules/{capsuleId}/flashcards - Get flashcards
    const flashcardsResource = capsuleResource.addResource('flashcards');
    
    // GET /capsules/{capsuleId}/quiz - Get quiz
    const quizResource = capsuleResource.addResource('quiz');
    
    // GET /capsules/{capsuleId}/mindmap - Get mind map
    const mindmapResource = capsuleResource.addResource('mindmap');
    
    // GET /capsules/{capsuleId}/notes - Get notes
    const notesResource = capsuleResource.addResource('notes');
    
    // GET /capsules/{capsuleId}/transcript - Get transcript
    const transcriptResource = capsuleResource.addResource('transcript');

    // GET /capsules/{capsuleId}/tags - Get capsule tags
    // POST /capsules/{capsuleId}/tags - Add tags to capsule
    // DELETE /capsules/{capsuleId}/tags - Remove tags from capsule
    const capsuleTagsResource = capsuleResource.addResource('tags');

    // POST /capsules/{capsuleId}/tags/generate - Generate automatic tags
    const generateCapsuleTagsResource = capsuleTagsResource.addResource('generate');

    // 5. Study Sessions API
    const studyResource = this.api.root.addResource('study');
    
    // POST /study/flashcards - Start flashcard session
    const flashcardStudyResource = studyResource.addResource('flashcards');
    
    // POST /study/quiz - Start quiz session
    const quizStudyResource = studyResource.addResource('quiz');
    
    // PUT /study/progress - Update study progress
    const progressResource = studyResource.addResource('progress');

    // 6. AI Tutor API
    const tutorResource = this.api.root.addResource('tutor');
    
    // POST /tutor/chat - Send message to AI tutor
    const chatResource = tutorResource.addResource('chat');
    
    // GET /tutor/conversations - Get conversation history
    const conversationsResource = tutorResource.addResource('conversations');
    
    // GET /tutor/conversations/{conversationId} - Get specific conversation
    const conversationResource = conversationsResource.addResource('{conversationId}');

    // 7. Search API
    const searchResource = this.api.root.addResource('search');
    
    // GET /search/capsules - Search capsules
    const searchCapsulesResource = searchResource.addResource('capsules');
    
    // GET /search/content - Search within content
    const searchContentResource = searchResource.addResource('content');

    // 8. Tags API
    const tagsResource = this.api.root.addResource('tags');
    
    // GET /tags/suggestions - Get tag suggestions
    const tagSuggestionsResource = tagsResource.addResource('suggestions');
    
    // Add method integrations for search endpoints
    searchCapsulesResource.addMethod('GET', new apigateway.LambdaIntegration(globalSearchFunction), protectedMethodOptions);
    searchContentResource.addMethod('GET', new apigateway.LambdaIntegration(searchNotesFunction), protectedMethodOptions);
    
    // POST /search/setup - Setup search infrastructure (admin endpoint)
    const searchSetupResource = searchResource.addResource('setup');
    searchSetupResource.addMethod('POST', new apigateway.LambdaIntegration(setupSearchInfrastructureFunction), protectedMethodOptions);
    
    // POST /search/index - Index content (internal endpoint)
    const searchIndexResource = searchResource.addResource('index');
    searchIndexResource.addMethod('POST', new apigateway.LambdaIntegration(indexContentFunction), protectedMethodOptions);

    // Add method integrations for tag endpoints
    capsuleTagsResource.addMethod('GET', new apigateway.LambdaIntegration(manageTagsFunction), protectedMethodOptions);
    capsuleTagsResource.addMethod('POST', new apigateway.LambdaIntegration(manageTagsFunction), protectedMethodOptions);
    capsuleTagsResource.addMethod('DELETE', new apigateway.LambdaIntegration(manageTagsFunction), protectedMethodOptions);
    generateCapsuleTagsResource.addMethod('POST', new apigateway.LambdaIntegration(generateTagsFunction), protectedMethodOptions);
    tagSuggestionsResource.addMethod('GET', new apigateway.LambdaIntegration(manageTagsFunction), protectedMethodOptions);

    // 9. Analytics API
    const analyticsResource = this.api.root.addResource('analytics');
    
    // GET /analytics/progress - Get user progress analytics
    const analyticsProgressResource = analyticsResource.addResource('progress');
    
    // GET /analytics/performance - Get performance metrics
    const performanceResource = analyticsResource.addResource('performance');

    // 9. Export API
    const exportResource = this.api.root.addResource('export');
    
    // POST /export/data - Export user data
    const exportDataResource = exportResource.addResource('data');
    
    // GET /export/{exportId} - Download export
    const exportDownloadResource = exportResource.addResource('{exportId}');

    // 10. Health Check API (public)
    const healthResource = this.api.root.addResource('health');
    
    // GET /health - Health check endpoint
    healthResource.addMethod('GET', new apigateway.LambdaIntegration(healthCheckFunction), publicMethodOptions);

    // Rate limiting and throttling
    const apiUsagePlan = new apigateway.UsagePlan(this, 'ApiUsagePlan', {
      name: `${props.stackName}-${props.environment}-usage-plan`,
      description: 'Usage plan for YouTube Learning Platform API',
      throttle: {
        rateLimit: 1000, // requests per second
        burstLimit: 2000, // burst capacity
      },
      quota: {
        limit: 100000, // requests per month
        period: apigateway.Period.MONTH,
      },
    });

    // Associate usage plan with API stage
    apiUsagePlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // API Key for additional rate limiting if needed
    const apiKey = new apigateway.ApiKey(this, 'ApiKey', {
      apiKeyName: `${props.stackName}-${props.environment}-key`,
      description: 'API Key for YouTube Learning Platform',
    });

    apiUsagePlan.addApiKey(apiKey);

    // CloudFront Distribution for frontend
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3StaticWebsiteOrigin(this.contentBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID (Web)',
    });

    new cdk.CfnOutput(this, 'MobileUserPoolClientId', {
      value: mobileUserPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID (Mobile)',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'Cognito Identity Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: `${this.userPool.userPoolId}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito User Pool Domain',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'ContentBucketName', {
      value: this.contentBucket.bucketName,
      description: 'S3 Content Bucket Name',
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });

    new cdk.CfnOutput(this, 'MainTableName', {
      value: this.mainTable.tableName,
      description: 'DynamoDB Main Table Name',
    });

    new cdk.CfnOutput(this, 'OpenSearchDomainEndpoint', {
      value: this.searchDomain.domainEndpoint,
      description: 'OpenSearch Domain Endpoint',
    });

    new cdk.CfnOutput(this, 'OpenSearchDomainArn', {
      value: this.searchDomain.domainArn,
      description: 'OpenSearch Domain ARN',
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Gateway Key ID',
    });

    new cdk.CfnOutput(this, 'UsagePlanId', {
      value: apiUsagePlan.usagePlanId,
      description: 'API Gateway Usage Plan ID',
    });
  }
}