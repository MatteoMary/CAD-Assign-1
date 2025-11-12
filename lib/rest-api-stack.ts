import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as custom from "aws-cdk-lib/custom-resources";

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Single-table
    const table = new dynamodb.Table(this, "MoviesSingleTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MoviesSingleTable",
    });

    const envCommon = { TABLE_NAME: table.tableName, REGION: cdk.Aws.REGION };
    const defaults = {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      handler: "handler",
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: envCommon,
    } as const;

    // Lambdas
    const getMovie = new node.NodejsFunction(this, "GetMovieFn", { ...defaults, entry: `${__dirname}/../lambdas/getMovieById.ts` });
    const getMovieActors = new node.NodejsFunction(this, "GetMovieActorsFn", { ...defaults, entry: `${__dirname}/../lambdas/getMovieCastMembers.ts` });
    const getMovieActor = new node.NodejsFunction(this, "GetMovieActorFn", { ...defaults, entry: `${__dirname}/../lambdas/getMovieCastMember.ts` });
    const getAwards = new node.NodejsFunction(this, "GetAwardsFn", { ...defaults, entry: `${__dirname}/../lambdas/getAwards.ts` });
    const postMovie = new node.NodejsFunction(this, "PostMovieFn", { ...defaults, entry: `${__dirname}/../lambdas/addMovie.ts` });
    const deleteMovie = new node.NodejsFunction(this, "DeleteMovieFn", { ...defaults, entry: `${__dirname}/../lambdas/deleteMovie.ts` });

    table.grantReadData(getMovie);
    table.grantReadData(getMovieActors);
    table.grantReadData(getMovieActor);
    table.grantReadData(getAwards);
    table.grantWriteData(postMovie);
    table.grantWriteData(deleteMovie);

    const stateLogger = new node.NodejsFunction(this, "StateChangeLoggerFn", { ...defaults, entry: `${__dirname}/../lambdas/events/stateChangeLogger.ts` });
    table.grantStreamRead(stateLogger);
    stateLogger.addEventSourceMapping("DdbStreamMapping", {
      eventSourceArn: table.tableStreamArn!,
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 10,
      enabled: true,
    });

    // API
    const api = new apig.RestApi(this, "AppRestApi", {
      description: "Movie App API (spec-compliant)",
      deployOptions: { stageName: "dev", loggingLevel: apig.MethodLoggingLevel.INFO, dataTraceEnabled: false, metricsEnabled: true },
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
        allowMethods: ["OPTIONS", "GET", "POST", "DELETE"],
        allowHeaders: apig.Cors.DEFAULT_HEADERS,
        allowCredentials: true,
      },
    });

    const authorizerFn = new node.NodejsFunction(this, "RequestAuthorizerFn", {
      ...defaults,
      entry: `${__dirname}/../lambdas/auth/authorizer.ts`,
      environment: { ...envCommon, USER_POOL_ID: process.env.USER_POOL_ID ?? "", CLIENT_ID: process.env.CLIENT_ID ?? "" },
    });
    const requestAuthorizer = new apig.RequestAuthorizer(this, "CookieRequestAuthorizer", {
      identitySources: [apig.IdentitySource.header("cookie")],
      handler: authorizerFn,
      resultsCacheTtl: cdk.Duration.minutes(0),
    });

    const apiKey = api.addApiKey("AdminApiKey");
    const plan = api.addUsagePlan("AdminPlan", { apiStages: [{ api, stage: api.deploymentStage }] });
    plan.addApiKey(apiKey);

    const addGet = (res: apig.IResource, fn: lambda.Function) =>
      res.addMethod("GET", new apig.LambdaIntegration(fn), { authorizer: requestAuthorizer, authorizationType: apig.AuthorizationType.CUSTOM });

    const addAdminWrite = (res: apig.IResource, method: "POST" | "DELETE", fn: lambda.Function) =>
      res.addMethod(method, new apig.LambdaIntegration(fn), { apiKeyRequired: true });

    const movies = api.root.addResource("movies");
    const movieId = movies.addResource("{movieId}");
    const actors = movieId.addResource("actors");
    const actorId = actors.addResource("{actorId}");
    const awards = api.root.addResource("awards");

    addGet(movieId, getMovie);          // GET /movies/{movieId}
    addGet(actors, getMovieActors);     // GET /movies/{movieId}/actors
    addGet(actorId, getMovieActor);     // GET /movies/{movieId}/actors/{actorId}
    addGet(awards, getAwards);          // GET /awards?movie=&actor=&awardBody=

    addAdminWrite(movies, "POST", postMovie);   // POST /movies
    addAdminWrite(movieId, "DELETE", deleteMovie); // DELETE /movies/{movieId}

    const seed = new custom.AwsCustomResource(this, "SingleTableSeed", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [table.tableName]: [
              { PutRequest: { Item: { PK: { S: "m1234" }, SK: { S: "xxxx" }, title: { S: "The Shawshank Redemption" }, releaseDate: { S: "05-03-1995" }, overview: { S: "A banker convicted of uxoricide forms a friendship over a quarter century with a hardened convict …" } } } },
              { PutRequest: { Item: { PK: { S: "a6789" }, SK: { S: "xxxx" }, name: { S: "Morgan Freeman" }, bio: { S: "Born in Memphis, Tennessee. After serving in the U.S. Air Force, he began his acting career in New York, gaining early recognition on the children’s show The Electric Company …" }, dob: { S: "01-06-1937" } } } },
              { PutRequest: { Item: { PK: { S: "c1234" }, SK: { S: "6789" }, roleName: { S: "Ellis Redding" }, roleDesc: { S: "A contraband smuggler serving a life sentence. Red is being interviewed for parole after having spent 20 years at Shawshank for murder …" } } } },
              { PutRequest: { Item: { PK: { S: "w1234" }, SK: { S: "Academy" }, category: { S: "Best Movie" }, year: { N: "1995" } } } },
              { PutRequest: { Item: { PK: { S: "w6789" }, SK: { S: "GoldenGlobe" }, category: { S: "Best Supporting Actor" }, year: { N: "1995" } } } }
            ],
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("SingleTableSeed_v1"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({ resources: [table.tableArn] }),
    });
    seed.node.addDependency(table);

    new cdk.CfnOutput(this, "TableName", { value: table.tableName });
    new cdk.CfnOutput(this, "ApiUrl", { value: api.url });
    new cdk.CfnOutput(this, "AdminApiKeyId", { value: apiKey.keyId });
  }
}
