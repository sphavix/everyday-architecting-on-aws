#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DataPipelineStack } from '../lib/stacks/serverless-home-energy-data-pipeline';
import { SharedResourcesStack } from '../lib/serverless-shared-resources/serverless-shared-resources';

const appEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const desc = 'Serverless Home Energy Monitoring Application - Data Pipeline Stack';

const app = new cdk.App();

const sharedResourcesStack = new SharedResourcesStack(app, 'SharedResourcesStack', {
  env: appEnv,
  description: desc,
  adminEmailAddress: app.node.tryGetContext('adminEmailAddress'),
});

const dataPipelineStack = new DataPipelineStack(app, 'DataPipelineStack', {
  env: appEnv,
  description: desc,
  rawDataLandingBucket: sharedResourcesStack.rawDataBucket,
  snsNotificationTopic: sharedResourcesStack.snsNotificationTopic,
  snsTopicCalculatorSummary: sharedResourcesStack.snsTopicCalculatorSummary,
});