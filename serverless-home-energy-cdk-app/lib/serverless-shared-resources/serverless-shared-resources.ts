import * as cdk from 'aws-cdk-lib';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';

export interface SharedResourcesStackProps extends cdk.StackProps {
    readonly stage?: string;
}

export class SharedResourcesStack extends cdk.Stack {
     
    public readonly calculatedEnergyTable: dynamodb.Table;

    constructor(scope: cdk.App, id: string, props: SharedResourcesStackProps) {
        super(scope, id, props);

        const stage = props.stage ?? 'dev';

        // Create DynamoDB Taable
        this.calculatedEnergyTable = new dynamodb.Table(this, 'CalculatedEnergyTable', {
            partitionKey: {
                name: 'customerId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: 'ttl',
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: true,
            },
        });

        // Add GSI for location querying
        this.calculatedEnergyTable.addGlobalSecondaryIndex({
            indexName: 'CustomerLocationsIndex',
            partitionKey: {
                name: 'customerId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'location',
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        // Add DynamoDB ouptut
        new cdk.CfnOutput(this, 'CalculatedEnergyTableName', {
            value: this.calculatedEnergyTable.tableName,
            description: 'Calculated Energy Table Name',
        });
    }
}