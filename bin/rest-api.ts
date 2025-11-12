#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CognitoStack } from "../lib/cognito-stack";
import { RestAPIStack } from "../lib/rest-api-stack";

const app = new cdk.App();

const cognito = new CognitoStack(app, "CognitoStack");

const rest = new RestAPIStack(app, "RestAPIStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

  new cdk.CfnOutput(rest, "UserPoolId", { value: cognito.node.tryGetContext("UserPoolId") ?? "See CognitoStack output" });
new cdk.CfnOutput(rest, "UserPoolClientId", { value: cognito.node.tryGetContext("UserPoolClientId") ?? "See CognitoStack output" });
