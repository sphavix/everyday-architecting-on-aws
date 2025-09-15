import boto3
from io import BytesIO
from PIL import Image, ImageOps
import os
import json
import uuid
from datetime import datetime

s3_client = boto3.client('s3')
size = int(os.getenv('THUMBNAIL_SIZE'))

dynamoDB = boto3.resource('dynamodb', region_name='eu-north-1')
dbTable = str(os.getenv('THUMB_TABLE'))

def s3_thumbnail_generator(event, context):
    # Get the bucket name and object key from the event
    print("EVENT:::", event)
    bucket_name = event['Records'][0]['s3']['bucket']['name']
    object_key = event['Records'][0]['s3']['object']['key']
    img_size = event['Records'][0]['s3']['object']['size']

    # only create a thumbnail on non thumbnail images
    if(not object_key.endswith("_thumbnail.png")):
        # get the image from s3
        image_obj = get_s3_image(bucket_name, object_key)

        # resize the image
        thumbnail = resize_image_to_thumbnail(image_obj)

        # get the new filename
        thumbnail_key = new_filename(object_key)

        # upload the thumbnail to s3
        url = upload_thumbnail_to_s3(thumbnail_key, thumbnail, bucket_name, img_size)
        print("Image:::", url)
        return url


def get_s3_image(bucket_name, object_key):
    # in this case the bucket is the same as the one where the image is uploaded to
    response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
    image_content = response['Body'].read()

    file = BytesIO(image_content)
    image = Image.open(file)
    return image

def resize_image_to_thumbnail(image):
    return ImageOps.fit(image, (size, size), Image.ANTIALIAS)

def new_filename(object_key):
    key_split = object_key.split('.', 1)
    return key_split[0] + "_thumbnail.png"

def upload_thumbnail_to_s3(key, image, bucket_name, image_size):
     # We are saving the image into a BytesIO object to avoid writing to disk
    out_thumbnail = BytesIO()

    # W e must specify the format to save as PNG 
    image.save(out_thumbnail, 'PNG')
    out_thumbnail.seek(0)

    response = s3_client.put_object(
        Bucket=bucket_name, 
        Key=key, 
        Body=out_thumbnail, 
        ContentType='image/png')
    print(response)

    #url = '{}/{}/{}'.format(s3_client.meta.endpoint_url, bucket_name, key)
    url = f'{s3_client.meta.endpoint_url}/{bucket_name}/{key}'

    # save the thumbnail to the database
    save_thumbnail_to_db(url_path=url, image_size=image_size)

    return url

def save_thumbnail_to_db(url_path, img_size):
    toint = float(img_size * 0.53)/1000
    table = dynamoDB.Table(dbTable)
    response = table.put_item(
        Item = {
            'id': str(uuid.uuid4),
            'url': str(url_path),
            'approxReducedSize': str(toint) + str( 'KB'),
            'createdAt': str(datetime.now()),
            'updatedAt': str(datetime.now())
        }
    )

    return {
        'statusCode': 200,
        'body': json.dumps(response),
        'headers': {
            'Content-Type': 'application/json',
        }
    }