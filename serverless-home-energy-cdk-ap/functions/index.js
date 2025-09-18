async function main(event){
    const msg = "Hello from Lambda!";

    console.log(msg);
    return {
        body: JSON.stringify(msg),
        statusCode: 200
    };
};

module.exports = { main };