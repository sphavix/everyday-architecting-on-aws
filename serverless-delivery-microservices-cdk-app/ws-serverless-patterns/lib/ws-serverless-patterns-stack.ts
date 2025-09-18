import { 
  Aws,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack, 
  StackProps,
  Tags
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';

export class WsServerlessPatternsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const usersTable = new dynamodb.Table(this, 'users-table', {
      tableName: `${Aws.STACK_NAME}-users`,
      partitionKey: {
        name: 'userid',
        type: dynamodb.AttributeType.STRING
      },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY
    });


    new CfnOutput(this, 'UsersTable', {
      description: 'Users DynamoDB Table',
      value: usersTable.tableName,
    });

    // nodejsFunctionProps object provides the ability to share common properties across multiple functions
    const nodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 128,
      timeout: Duration.seconds(100),
      tracing: lambda.Tracing.ACTIVE,
    };


    const usersFunction = new lambda_nodejs.NodejsFunction(this, 'users-function', {
      entry: './src/api/users/index.ts',
      handler: 'handler', ...nodejsFunctionProps,
      environment: {
        USERS_TABLE: usersTable.tableName
      },
    });

    usersTable.grantReadWriteData(usersFunction);
    Tags.of(usersFunction).add('Stack', `${Aws.STACK_NAME}`);

    new CfnOutput(this, 'UsersFunction', {
      description: 'Users Lambda Function',
      value: usersFunction.functionName,
    }); 
  }
}
