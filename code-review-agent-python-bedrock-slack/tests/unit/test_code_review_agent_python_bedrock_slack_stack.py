import aws_cdk as core
import aws_cdk.assertions as assertions

from code_review_agent_python_bedrock_slack.code_review_agent_python_bedrock_slack_stack import CodeReviewAgentPythonBedrockSlackStack

# example tests. To run these tests, uncomment this file along with the example
# resource in code_review_agent_python_bedrock_slack/code_review_agent_python_bedrock_slack_stack.py
def test_sqs_queue_created():
    app = core.App()
    stack = CodeReviewAgentPythonBedrockSlackStack(app, "code-review-agent-python-bedrock-slack")
    template = assertions.Template.from_stack(stack)

#     template.has_resource_properties("AWS::SQS::Queue", {
#         "VisibilityTimeout": 300
#     })
