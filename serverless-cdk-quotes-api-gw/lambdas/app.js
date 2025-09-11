const AWS = require("aws-sdk");

let dynamoDB = new AWS.DynamoDB.DocumentClient();

const QUOTES_TABLE = process.env.QUOTES_TABLE;

exports.handler = async (event, context) => {
    console.log("Event:::", event);

    let path = event.resource;
    let httpMethod = event.httpMethod;
    let route = httpMethod.concat(" ").concat(path);

    let data = JSON.parse(event.body);

    let body;
    let statusCode = 200;

    try{
        switch(route){
            case "GET /quotes":
                body = await listQuotes();
                break;
            case "GET /quotes/{id}":
                body = await getQuote(event.pathParameters.id);
                break;
            case "POST /quotes":
                body = await saveQuote(data);
                break;
            case "DELETE /quotes/{id}":
                body = await deleteQuote(event.pathParameters.id);
                break;
            case "PUT /quotes/{id}":
                body = await updateQuote(event.pathParameters.id, data);
                break;
        
            default:
                throw new Error(`Unsupported route: "${route}"`);
        }
    }catch(error){
        console.error(error);
        statusCode = 400;
        body = error.message;
    }finally{
        console.log(body);
        body = JSON.stringify(body);
    }

    return sendResonse(statusCode, body);
};

async function listQuotes(){
    const params = {
        TableName: QUOTES_TABLE
    }
    return dynamoDB
            .scan(params)
            .promise()
            .then((data) => {
                return data.Items;
            });
}

async function getQuote(id){
    const params = {
        TableName: QUOTES_TABLE,
        Key: {
            id: id
        }
    }

    return dynamoDB
            .get(params)
            .promise()
            .then((item) => {
                return item.Item;
            });
}

async function saveQuote(data) {
    const date = new Date();
    const time = date.getTime();

    const quote = {
        id: time.toString(),
        quote: data.quote,
        author: data.author,
    }

    const params = {
        TableName: QUOTES_TABLE,
        Item: quote
    }

    return dynamoDB
                .put(params)
                .promise()
                .then(() => {
        return quote;
    }).catch((error) => {
        console.error("DynamoDB error: ", error);
        throw new Error("Could not create the quote item.");
    });
}

async function deleteQuote(id){
    const params = {
        TableName: QUOTES_TABLE,
        Key: {
            id: id
        }
    }

    return dynamoDB
            .delete(params)
            .promise()
            .then(() => {
                return id;
            });
}

async function updateQuote(id, data){
    const datetime = new Date().toISOString();
    const params = {
        TableName: QUOTES_TABLE,
        Key: {
            id: id
        },
        ExpressionAttributeValues: {
            ":quote": data.quote,
            ":author": data.author,
            ":updatedAt": datetime
        },
        UpdateExpression:
            "SET quote = :quote, author = :author, updatedAt = :updatedAt",
            ReturnValues: "UPDATED_NEW"
    };
    
    await dynamoDB
            .update(params)
            .promise()
            .then(() => {
                return `Quote with id: ${id} has been updated.`;
            });
}

const sendResonse = (status, body) => {
    var response  = {
        statusCode: status,
        headers: { "Content-Type": "application/json" },
        body,
    }
    return response;
}