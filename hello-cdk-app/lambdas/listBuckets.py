import boto3

client = boto3.client('s3')

def main(event, context):
    response = client.list_buckets()
    buckets = []
    for bucket in response['Buckets']:
        buckets.append(bucket['Name'])
        print(f"  {bucket['Name']}")
    return buckets