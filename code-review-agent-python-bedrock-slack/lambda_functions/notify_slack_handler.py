import json
import logging
import os
import urllib.request
from typing import Dict, Any
from aws_lambda_powertools import Logger, Tracer

from utils import get_slack_webhook, PRReviewError


logger = Logger()
tracer = Tracer()

GH_BASE = os.getenv("GITHUB_URL_BASE", "https://github.com")

slack_webhook = get_slack_webhook()
if not slack_webhook:
    raise PRReviewError("No slack webhook found")

@tracer.capture_lambda_handler
def lambda_handler(event: Dict[str, Any], _context) -> Dict[str, Any]:
    logger.info("notify_slack received event", extra=event)

    # ---------- validation --------------------------------------------------
    required = ("repository", "pull_request_number", "owner", "result")
    if missing := [k for k in required if k not in event]:
        msg = f"Missing keys for notify_slack: {', '.join(missing)}"
        logger.error(msg)
        return {"statusCode": 400, "body": json.dumps({"error": msg})}

    try:
        slack_msg = _format_slack_message(event)
        _post_to_slack(slack_msg)
        logger.info("Slack notification sent")
        return {"statusCode": 200, "body": json.dumps({"status": "sent"})}
    except Exception as e:
        logger.exception("Failed to post to Slack")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}


@tracer.capture_method
def _format_slack_message(payload: Dict[str, Any]) -> str:
    """Build a Slack-friendly message block."""
    repo = payload["repository"]
    pr_number = payload["pull_request_number"]
    owner = payload["owner"]

    # stats returned by post_review_comments
    ok = payload["result"]["successful_posts"]
    fail = payload["result"]["failed_posts"]

    pr_url = f"{GH_BASE}/{owner}/{repo}/pull/{pr_number}"

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f":memo: *PR Review Comments Posted*\n"
                    f"*Repo*: `{owner}/{repo}`  •  *PR*: <{pr_url}|#{pr_number}>\n"
                    f":white_check_mark: *Success*: {ok}   "
                    f":x: *Failed*: {fail}"
                ),
            },
        }
    ]

    return json.dumps({"blocks": blocks})

@tracer.capture_method
def _post_to_slack(message_json: str) -> None:
    req = urllib.request.Request(
        url=slack_webhook,
        data=message_json.encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        if resp.status != 200:
            body = resp.read().decode()
            raise RuntimeError(f"Slack returned {resp.status}: {body}")
