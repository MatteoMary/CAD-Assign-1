import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { AuthApi } from './constructs/auth-api'
import { AppApi } from './constructs/app-api'

export class CognitoStack extends cdk.Stack {
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new UserPool(this, "UserPool", {
      signInAliases: { username: true, email: true },
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const appClient = userPool.addClient("AppClient", {
      authFlows: { userPassword: true },
    });

    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = appClient.userPoolClientId;

    new AuthApi(this, 'AuthServiceApi', {
      userPoolId: this.userPoolId,
      userPoolClientId: this.userPoolClientId,
    });

    new AppApi(this, 'AppApi', {
      userPoolId: this.userPoolId,
      userPoolClientId: this.userPoolClientId,
    });

    new cdk.CfnOutput(this, "UserPoolId", { value: this.userPoolId, exportName: "CognitoStack-UserPoolId" });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: this.userPoolClientId, exportName: "CognitoStack-UserPoolClientId" });
  }
}
