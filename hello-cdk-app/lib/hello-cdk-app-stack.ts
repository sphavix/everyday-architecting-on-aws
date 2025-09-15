import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { join } from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';

export class HelloCdkAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const handlerFunc = new Function(this, 'Hello-lambda', {
      //runtime: Runtime.NODEJS_18_X,
      runtime: Runtime.PYTHON_3_9,
      memorySize: 512,
      handler: 'listLambdas.main',
      code: Code.fromAsset(join(__dirname, '../lambdas')),
      environment: {
        NAME: 'James',
        AGE: '23'
      }
    });

    //Create and attach a policy to the lambda function to allow it to list S3 buckets
    const listBucketsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:*'],
      resources: ['*'],
    });

    const listLambdasPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:*'],
      resources: ['*'],
    });

    handlerFunc.role?.attachInlinePolicy(new iam.Policy(this, 'list-lambda-resources',{
      statements: [listBucketsPolicy, listLambdasPolicy]
    }));

    // Output the ARN for this function using the level 1 construct
    new cdk.CfnOutput(this, 'function-arn', {
      value: handlerFunc.functionArn,
    });
  }
}
