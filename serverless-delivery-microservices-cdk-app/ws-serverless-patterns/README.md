# Serverless Workshop - Module 2
This is implementation of the backend REST API using TypeScript and AWS CDK.

## Initial Setup
If you haven't installed dependencies, run `npm install`.
```
npm install
```

## Deploy the module
Use AWS CDK to bootstrap the environment, synthesize CloudFormation template, and deploy.
```
npx cdk bootstrap
cdk synth
cdk deploy
```

## Clean up
Use AWS CDK to delete the module.
```
cdk destroy --all
```