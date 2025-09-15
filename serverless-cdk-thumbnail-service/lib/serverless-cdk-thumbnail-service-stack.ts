import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function, Runtime, Code, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { join } from 'path';
import { Duration } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import  * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Table } from 'aws-cdk-lib/aws-dynamodb';


export class ServerlessCdkThumbnailServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new Table(this, 'thumbnail-table', {
      partitionKey: { 
        name: 'id', 
        type: cdk.aws_dynamodb.AttributeType.STRING 
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const pillowLayer = new LayerVersion(this, 'PillowLayer', {
      code: Code.fromAsset(join(__dirname, '../lambda-layers/pillow'), {
        bundling: {
          image: Runtime.PYTHON_3_9.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output/python && ' +
            'find /asset-output/python -name "*.pyc" -delete && ' +
            'find /asset-output/python -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true'
          ],
        },
      }),
      compatibleRuntimes: [Runtime.PYTHON_3_9],
      description: 'A layer to provide the Pillow library',
    });
   
    // create the image resize lambda function
    const funcHandler = new Function(this, 'handler-function-image-resize', {
      runtime: Runtime.PYTHON_3_9,
      timeout: Duration.seconds(20),
      handler: 'app.s3_thumbnail_generator',
      code: Code.fromAsset(join(__dirname, '../functions')),
      layers: [pillowLayer],
      memorySize: 512,
      environment: {
        THUMB_TABLE: table.tableName,
        REGION_NAME: "eu-north-1",
        THUMBNAIL_SIZE: "128"
      }
    });

    // grant the lambda function read/write permissions to the DynamoDB table
    table.grantReadWriteData(funcHandler);

    // create the S3 bucket
    const s3Bucket = new s3.Bucket(this, 'thumbnail-service-bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });


    // grant the lambda function read/write permissions to the S3 bucket
    s3Bucket.grantReadWrite(funcHandler);

    // add an event notification to the S3 bucket to trigger the lambda function on object creation
    s3Bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(funcHandler));

    funcHandler.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:*'],
        resources: ['*'],
      }));
  }
}
