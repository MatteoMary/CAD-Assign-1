import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { movies, movieCasts } from "../seed/movies";

export interface RestProps extends cdk.StackProps {
  userPoolId: string;
  userPoolClientId?: string;
}

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: RestProps) {
    super(scope, id, props);

    const moviesTable = new dynamodb.Table(this, "MoviesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Movies",
    });

    const movieCastsTable = new dynamodb.Table(this, "MovieCastTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "actorId", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieCast",
    });

    movieCastsTable.addLocalSecondaryIndex({
      indexName: "roleIx",
      sortKey: { name: "roleName", type: dynamodb.AttributeType.STRING },
    });

    const getMovieCastMembersFn = new lambdanode.NodejsFunction(this, "GetCastMemberFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/getMovieCastMember.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        CAST_TABLE_NAME: movieCastsTable.tableName,
        MOVIES_TABLE_NAME: moviesTable.tableName,
        REGION: cdk.Aws.REGION,
      },
    });

    const getMovieCastMemberFn = new lambdanode.NodejsFunction(this, "GetMovieCastMemberFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
     entry: `${__dirname}/../lambdas/getMovieCastMember.ts`, // singular file
     timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
       CAST_TABLE_NAME: movieCastsTable.tableName,
       REGION: cdk.Aws.REGION,
  },
});

    const newMovieFn = new lambdanode.NodejsFunction(this, "AddMovieFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/addMovie.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: moviesTable.tableName,
        REGION: cdk.Aws.REGION,
      },
    });

    const getMovieByIdFn = new lambdanode.NodejsFunction(this, "GetMovieByIdFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/getMovieById.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: moviesTable.tableName,
        REGION: cdk.Aws.REGION,
      },
    });

    const getAllMoviesFn = new lambdanode.NodejsFunction(this, "GetAllMoviesFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/getAllMovies.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: moviesTable.tableName,
        REGION: cdk.Aws.REGION,
      },
    });

    const deleteMovieFn = new lambdanode.NodejsFunction(this, "DeleteMovieFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/deleteMovie.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: moviesTable.tableName,
        REGION: cdk.Aws.REGION,
      },
    });

    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [moviesTable.tableName]: generateBatch(movies),
            [movieCastsTable.tableName]: generateBatch(movieCasts),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [moviesTable.tableArn, movieCastsTable.tableArn],
      }),
    });

    moviesTable.grantReadData(getMovieByIdFn);
    moviesTable.grantReadData(getAllMoviesFn);
    moviesTable.grantReadWriteData(newMovieFn);
    moviesTable.grantReadWriteData(deleteMovieFn);
    movieCastsTable.grantReadData(getMovieCastMembersFn);
    moviesTable.grantReadData(getMovieCastMembersFn);
    movieCastsTable.grantReadData(getMovieCastMembersFn);
    movieCastsTable.grantReadData(getMovieCastMemberFn)

    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
      deployOptions: { stageName: "dev" },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const authorizerFn = new lambdanode.NodejsFunction(this, "MoviesAuthorizerFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/auth/authorizer.ts`,
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        USER_POOL_ID: props?.userPoolId ?? "",
        REGION: cdk.Aws.REGION,
      },
    });

    const requestAuthorizer = new apig.RequestAuthorizer(this, "MoviesRequestAuthorizer", {
      identitySources: [apig.IdentitySource.header("cookie")],
      handler: authorizerFn,
      resultsCacheTtl: cdk.Duration.seconds(0),
    });

    const moviesEndpoint = api.root.addResource("movies");
    const movieEndpoint = moviesEndpoint.addResource("{movieId}");
    const movieCastEndpoint = moviesEndpoint.addResource("cast");
    const actorsEndpoint = movieEndpoint.addResource("actors");
    const actorEndpoint  = actorsEndpoint.addResource("{actorId}");
    

moviesEndpoint.addMethod("GET", new apig.LambdaIntegration(getAllMoviesFn, { proxy: true }), {
  authorizer: requestAuthorizer, authorizationType: apig.AuthorizationType.CUSTOM, apiKeyRequired: false,
});

movieEndpoint.addMethod("GET", new apig.LambdaIntegration(getMovieByIdFn, { proxy: true }), {
  authorizer: requestAuthorizer, authorizationType: apig.AuthorizationType.CUSTOM, apiKeyRequired: false,
});

actorsEndpoint.addMethod("GET", new apig.LambdaIntegration(getMovieCastMembersFn, { proxy: true }), {
  authorizer: requestAuthorizer, authorizationType: apig.AuthorizationType.CUSTOM, apiKeyRequired: false,
});

actorEndpoint.addMethod("GET", new apig.LambdaIntegration(getMovieCastMemberFn, { proxy: true }), {
  authorizer: requestAuthorizer, authorizationType: apig.AuthorizationType.CUSTOM, apiKeyRequired: false,
});

moviesEndpoint.addMethod("POST", new apig.LambdaIntegration(newMovieFn, { proxy: true }), {
  apiKeyRequired: true,
});

movieEndpoint.addMethod("DELETE", new apig.LambdaIntegration(deleteMovieFn, { proxy: true }), {
  apiKeyRequired: true,
});

    new cdk.CfnOutput(this, "ApiUrl", { value: api.url! });
  }
}
