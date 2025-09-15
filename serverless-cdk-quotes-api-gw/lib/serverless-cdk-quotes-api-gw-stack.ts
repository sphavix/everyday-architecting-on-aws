import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { join } from 'path';

export class ServerlessCdkQuotesApiGwStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create dynamodb table
    const table = new Table(this, 'quotes-table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    // create the lambda function
    const handlerFunction = new Function(this, 'qoutesHandler', {
      runtime: Runtime.NODEJS_18_X,
      code: Code.fromAsset(join(__dirname, '../lambdas')),
      handler: 'app.handler',
      environment: {
        QUOTES_TABLE: table.tableName,
      },
    });

    // grant the lambda function read/write permissions to the table
    table.grantReadWriteData(handlerFunction);

    // instantiate the API Gateway
    const api = new RestApi(this, 'quotes-api', {
      description: 'Quotes API Gateway',
    });

    // create a resources for /quotes, and integrate with the Lambda function
    const lambdaIntegration = new apigateway.LambdaIntegration(handlerFunction, {
      proxy: true,
    });

    const mainPath = api.root.addResource("quotes");
    const idPath = mainPath.addResource("{id}");

    mainPath.addMethod('GET', lambdaIntegration); // GET: /quotes
    mainPath.addMethod('POST', lambdaIntegration); // POST: /quotes
    idPath.addMethod('DELETE', lambdaIntegration); // DELETE: /quotes/{id}
    idPath.addMethod('PUT', lambdaIntegration); // UPDATE: /quotes/{id}
    
  }
}
