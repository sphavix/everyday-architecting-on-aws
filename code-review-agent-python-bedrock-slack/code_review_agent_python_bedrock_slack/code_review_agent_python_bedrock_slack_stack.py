from aws_cdk import (
    # Duration,
    Stack,
    # aws_sqs as sqs,
)
from 
from constructs import Construct
from aws_cdk import aws_secretsmanager as secretsmanager
from aws_cdk import aws_lambda as lambda
from aws_cdk.aws_lambda_python_alpha import PythonFunction


class CodeReviewAgentPythonBedrockSlackStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # The code that defines your stack goes here

        # Import existing GitHub token secret
        gh_token = secretsmanager.Secret.from_secret_name_v2(
            self, "GitHubToken", secret_name="everyday-secrets/GITHUB_TOKEN"
        )

        pr_review_fn = PythonFunction(self, "PRReviewFunction",
            entry="lambda_functions/",  # path to your lambda function directory
            index="pr_review_handler.py",  # file name of your lambda function
            handler="lambda_handler",  # function name in your lambda function
            runtime=lambda.Runtime.PYTHON_3_11,
            timeout=Duration.seconds(10),
            environment={
                "POWERTOOLS_SERVICE_NAME": "pr-reviewer",
                "POWERTOOLS_METRICS_NAMESPACE": "PRReviewer",
                "POWERTOOLS_LOG_LEVEL": "INFO",
            },
        )

        # Grant the Lambda function read access to the GitHub token secret
        gh_token.grant_read(pr_review_fn)

        # Allow lambda to call Bedrock
        pr_review_fn.add_to_role_policy(iam.PolicyStatement(
            actions=[
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
            ],
            resources=["arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0"],  # You can restrict this to specific Bedrock models if needed
        ))

        # Import existing Slack webhook URL secret
        slack_webhook_url = secretsmanager.Secret.from_secret_name_v2(
            self, "SlackWebhookURL", secret_name="everyday-secrets/SLACK_WEBHOOK_URL"
        )

        # Create notify lambda function
        notify_fn = PythonFunction(self, "NotifyFunction",
            entry="lambda_functions/",  # path to your lambda function directory
            index="notify_slack_handler.py",  # file name of your lambda function
            handler="lambda_handler",  # function name in your lambda function
            runtime=lambda.Runtime.PYTHON_3_11,
            timeout=Duration.minutes(1),
            environment={
                "POWERTOOLS_SERVICE_NAME": "notify_slack",
                "POWERTOOLS_METRICS_NAMESPACE": "NotifySlack",
                "POWERTOOLS_LOG_LEVEL": "INFO",
            },
        )

        # Grant the Lambda function read access to the Slack webhook URL secret
        slack_webhook_url.grant_read(notify_fn)

        # Create REST API Handler Lambda function to orchestrate the process
        api_handler_fn = PythonFunction(self, "APIHandlerFunction",
            entry="lambda_functions/",  # path to your lambda function directory
            index="api_handler.py",  # file name of your lambda function
            handler="lambda_handler",  # function name in your lambda function
            runtime=lambda.Runtime.PYTHON_3_11,
            timeout=Duration.seconds(30),
            environment={
                "POWERTOOLS_SERVICE_NAME": "pr-review-api",
                "POWERTOOLS_METRICS_NAMESPACE": "PRReviewer",
                "POWERTOOLS_LOG_LEVEL": "INFO",
                "STATE_MACHINE_ARN": workflow.state_machine_arn,
            },
        )

        # X-Ray + CloudWatch metrics + structured logging
        api_handler_fn.add_to_role_policy(iam.PolicyStatement(
            actions=[
                "xray:PutTraceSegments",
                "xray:PutTelemetryRecords",
                "cloudwatch:PutMetricData",
            ],
            resources=["*"],
        ))

        # Load directly from file (no need to `open`/`json.load` yourself)
        definition = sfn.DefinitionBody.from_file("state_machine/github_review_workflow.asl.json")

        workflow = sfn.StateMachine(
            self, "PRReviewerWorkflow",
            definition_body=definition,
            definition_substitutions={
                "INVOKE_LAMBDA_FUNCTION_ARN": pr_review_fn.function_arn,
            },
            role=sfn_role,
            state_machine_type=sfn.StateMachineType.STANDARD,
        )

        # Create sfn role for lambda to start execution
        sfn_role = iam.Role(
            self, "PRReviewerStepFunctionRole",
            assumed_by=iam.ServicePrincipal("states.amazonaws.com"),
            description="Allows Step Functions to invoke Bedrock and Lambda"
        )

        # Allow the Step Function to invoke the PR review Lambda function
        sfn_role.add_to_policy(iam.PolicyStatement(
            actions=["lambda:InvokeFunction"],
            resources=[pr_review_fn.function_arn],
        ))

        # Create API Gateway to expose the API handler Lambda function and use Plan
        api = apigateway.RestApi(
            self, "PRReviewerApi",
            rest_api_name="PR Reviewer API",
            description="API for AI-powered PR reviews",
            deploy_options=apigateway.StageOptions(
                stage_name="prod",
                throttling_rate_limit=100,
                throttling_burst_limit=50,
            ),
        )

        api_key = api.add_api_key("PRReviewerApiKey",
            api_key_name="PR-Reviewer-Key",
            description="API key for PR Reviewer service"
        )

        usage_plan = api.add_usage_plan("PRReviewerUsagePlan",
            name="PR-Reviewer-Plan",
            throttle=apigateway.ThrottleSettings(rate_limit=100, burst_limit=50),
            quota=apigateway.QuotaSettings(limit=1000, period=apigateway.Period.MONTH),
        )
        usage_plan.add_api_key(api_key)
        usage_plan.add_api_stage(api=api, stage=api.deployment_stage)

        # Grant permission to start, describe, and execution of the state machine 
        workflow.grant_start_execution(api_handler_fn)
        api_handler_fn.add_to_role_policy(iam.PolicyStatement(
            actions=["states:DescribeExecution"],
            resources=["*"],
        ))



