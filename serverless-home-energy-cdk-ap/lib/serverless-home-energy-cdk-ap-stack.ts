import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import path from 'path';

export class ServerlessHomeEnergyCdkApStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for raw data storage with L2 Construct
    const rawDataBucket = new CfnBucket(this, 'rawDataBucket', {
      bucketName: 'raw-data-bucket-uniq-bucket',
      accessControl: 'Private',
    })

    const helloCdkLambda = new Function(this, 'HelloCdkLambda', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.main',
      code: Code.fromAsset(path.join(__dirname, '../functions'))
    });
  }
}
