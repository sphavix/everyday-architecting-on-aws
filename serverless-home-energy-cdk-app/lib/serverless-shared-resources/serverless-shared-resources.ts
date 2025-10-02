import * as cdk from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_sns_subscriptions as subscriptions } from 'aws-cdk-lib';

export interface SharedResourcesStackProps extends cdk.StackProps {
    readonly adminEmailAddress: string;
}

export class SharedResourcesStack extends cdk.Stack {
     
    // Properties to be made available to other stacks
    public readonly rawDataBucket: s3.Bucket;
    public readonly snsNotificationTopic: sns.Topic;
    public readonly snsTopicCalculatorSummary: sns.Topic;

    constructor(scope: cdk.App, id: string, props: SharedResourcesStackProps) {
        super(scope, id, props);

        // S3 Bucket for raw data storage with L2 Construct
        this.rawDataBucket = new s3.Bucket(this, 'RawDataBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            lifecycleRules: [{
                expiration: cdk.Duration.days(1),
            }],
        });

        // SNS Topic for notifications
        this.snsNotificationTopic = new sns.Topic(this, 'SnsTopicRawData', {
            displayName: 'SNS Topic for Raw Data Notifications',
        });

        // Add email subscription to the SNS topic
        this.snsNotificationTopic.addSubscription(new subscriptions.EmailSubscription(props.adminEmailAddress));

        // Create SNS Notification Topic for Calculator Summary
        this.snsTopicCalculatorSummary = new sns.Topic(this, 'SnsTopicCalculatorSummary', {
            displayName: 'SNS Topic for Calculator Summary',
        });

        // Add email subscription to the Calculator Summary SNS topic
        this.snsTopicCalculatorSummary.addSubscription(new subscriptions.EmailSubscription(props.adminEmailAddress));
    }
}