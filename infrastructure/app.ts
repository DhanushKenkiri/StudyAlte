#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { YoutubeLearningPlatformStack } from './youtube-learning-platform-stack';

const app = new cdk.App();

const stackName = app.node.tryGetContext('stackName') || 'YoutubeLearningPlatform';
const environment = app.node.tryGetContext('environment') || 'dev';

new YoutubeLearningPlatformStack(app, `${stackName}-${environment}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  environment,
  stackName,
});