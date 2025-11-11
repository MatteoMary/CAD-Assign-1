#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { RestAPIStack } from '../lib/rest-api-stack';
import { CognitoStack } from '../lib/cognito-stack';

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }; 

const cognito = new CognitoStack(app, 'CognitoStack', { env });
const api     = new RestAPIStack(app, 'RestAPIStack', { env });

api.addDependency(cognito);