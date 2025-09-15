#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ServerlessCdkThumbnailServiceStack } from '../lib/serverless-cdk-thumbnail-service-stack';

const app = new cdk.App();
new ServerlessCdkThumbnailServiceStack(app, 'ServerlessCdkThumbnailServiceStack', {
  
  
});