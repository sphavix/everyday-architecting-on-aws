exports.handler = async (event, context) => {
    const name = process.env.NAME
    const age = process.env.AGE
    return `Hello, my name is ${name} and I am ${age} years old.`;
}