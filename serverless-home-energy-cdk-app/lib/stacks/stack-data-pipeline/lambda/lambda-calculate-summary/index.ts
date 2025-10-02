import { S3Event } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';

const s3Client = new S3Client( {});
const snsClient = new SNSClient({});
const dynamoDBClient = new DynamoDBClient({});

interface Location {
    locationId: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
}

interface EnergyReading {
    customerId: string;
    customerName: string;
    locationId: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    timestamp: string;
    kWh: number;
    outsideTemp: number;
    electricVehicleCharging: boolean;
    hotWaterHeater: boolean;
    poolPump: boolean;
    heatPump: boolean;
  }

  export const main = async (event: S3Event): Promise<void> => {
    try{
        const bucket = event.Records[0].s3.bucket.name;
        const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

        // Get the JSON file from S3
        const response = await s3Client.send(new GetObjectCommand({
            Bucket: bucket,
            Key: key
        }));

        const jsonString = await response.Body?.transformToString();
        if(!jsonString) {
            throw new Error('No data found in S3 object');
        }

        const data = JSON.parse(jsonString) as EnergyReading[];
        if(!data.length) throw new Error('No data found in JSON object');

        // Extract energy readings from JSON
        const firstReading = data[0];
        const firstDate = new Date(firstReading.timestamp);
        const monthKey = `${firstDate.getFullYear()}-${String(firstDate.getMonth() + 1)
            .padStart(2, '0')}`;

        // Extract customer and location details
        const customerInfo = {
            customerId: firstReading.customerId,
            customerName: firstReading.customerName,
        };

        const locationInfo = {
            locationId: firstReading.locationId,
            address: firstReading.address,
            city: firstReading.city,
            state: firstReading.state,
            postalCode: firstReading.postalCode
        };

        // Create composite key for DynamoDB data
        const primaryKey = `${customerInfo.customerId}#${locationInfo.locationId}#${monthKey}`;

        // Check if data already exists in DynamoDB
        let shouldUpdate = true;
        const existingItem = await dynamoDBClient.send(new GetItemCommand({
            TableName: process.env.CALCULATED_ENERGY_TABLE,
            Key: {
                primaryKey: { S: primaryKey },
            },
        }));

        // Calculate energy summary
        const summary = calculateSummary(data);

        if(existingItem.Item) {
            const existingSummary = JSON.parse(existingItem.Item.summary.S!);
            shouldUpdate = !deepEqual(existingSummary, summary);
        }

        if(!shouldUpdate) {
            // Store summary in DynamoDB
            await dynamoDBClient.send(new PutItemCommand({
                TableName: process.env.CALCULATED_ENERGY_TABLE,
                Item: {
                    primaryKey: { S: primaryKey },
                    timestamp: { S: new Date().toISOString() },
                    customerId: { S: customerInfo.customerId },
                    customerName: { S: customerInfo.customerName },
                    locationId: { S: locationInfo.locationId },
                    address: { S: locationInfo.address },
                    city: { S: locationInfo.city },
                    state: { S: locationInfo.state },
                    postalCode: { S: locationInfo.postalCode },
                    summary: { S: JSON.stringify(calculateSummary(data)) },
                    rawData: { S: jsonString },
                },
            }));

            // Update SNS topic 
            await snsClient.send(new PublishCommand({
                TopicArn: process.env.SNS_TOPIC_CACULATOR_SUMMARY,
                Subject: `Energy Summary for ${customerInfo.customerName} - ${monthKey}`,
                Message: JSON.stringify({
                    location: locationInfo,
                    month: monthKey,
                    summary: summary,
                    status: existingItem.Item ? 'UPDATED' : 'NEW'
                },
                null, 2
            ),
            }));

            console.log(
                `Successfully ${existingItem.Item ? 'updated' : 'created'} summary for ${locationInfo.address} - ${monthKey}`
            );
        }else {
            console.log(`No changes detected for ${locationInfo.address} - ${monthKey}, skipping update.`);
        }
    } catch(error){
        console.error('Error processing S3 event:', error);
        throw error;
    }
  };

  function calculateSummary(data: EnergyReading[]) {
    const summary = {
        period: {
            start: data[0].timestamp,
            end: data[data.length - 1].timestamp,
          },
        totalKWh: 0,
        averages: {
            daily: 0,
            byHour: new Array(24).fill(0),
            temperature: 0,
        },
        deviceUsage: {
            evChargingHours: 0,
            hotWaterHours: 0,
            poolPumpHours: 0,
            heatPumpHours: 0,
        },
        peakUsage: {
            value: 0,
            timestamp: "",
            temperature: 0,
        },
    };

    // Calculate totals and find peak usage
    data.forEach((reading) => {
        summary.totalKWh += reading.kWh;
        summary.averages.temperature += reading.outsideTemp;

        const hour = new Date(reading.timestamp).getHours();
        summary.averages.byHour[hour] += reading.kWh;

        if(reading.kWh > summary.peakUsage.value) {
            summary.peakUsage = {
                timestamp: reading.timestamp,
                value: reading.kWh,
                temperature: reading.outsideTemp,
            };
        }

        if(reading.electricVehicleCharging) summary.deviceUsage.evChargingHours ++;
        if(reading.hotWaterHeater) summary.deviceUsage.hotWaterHours ++;
        if(reading.poolPump) summary.deviceUsage.poolPumpHours ++;
        if(reading.heatPump) summary.deviceUsage.heatPumpHours ++;
    });

    // Calculate averages after totals
    const days = Math.ceil(data.length / 24);
    summary.averages.daily = summary.totalKWh / days;
    summary.averages.temperature /= data.length;
    summary.averages.byHour = summary.averages.byHour.map((total) => total / days);

    return summary;
  }

  // Helper function to compare objects for deep equality
  function deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== "object" || typeof obj2 !== "object") return false;
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) return false;
    return keys1.every((key) => deepEqual(obj1[key], obj2[key]));
  }