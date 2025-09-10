import boto3

client = boto3.client('lambda')

def main(event, context):
    response = client.list_functions()
    return response