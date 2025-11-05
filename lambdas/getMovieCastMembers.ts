import { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
  GetCommand,
  GetCommandInput,
} from "@aws-sdk/lib-dynamodb";

const ddb = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event): Promise<APIGatewayProxyResultV2> => {
  try {
    console.log("Event:", JSON.stringify(event));
    const qs = event.queryStringParameters ?? {};

    if (!qs.movieId) return json(400, { message: "Missing movieId parameter" });
    const movieId = Number(qs.movieId);
    if (!Number.isFinite(movieId)) return json(400, { message: "Invalid movieId parameter" });

    let input: QueryCommandInput = {
      TableName: process.env.CAST_TABLE_NAME,
    };

    if (qs.roleName) {
      input = {
        ...input,
        IndexName: "roleIx",
        KeyConditionExpression: "movieId = :m AND begins_with(roleName, :r)",
        ExpressionAttributeValues: { ":m": movieId, ":r": qs.roleName },
      };
    } else if (qs.actorName) {
      input = {
        ...input,
        KeyConditionExpression: "movieId = :m AND begins_with(actorName, :a)",
        ExpressionAttributeValues: { ":m": movieId, ":a": qs.actorName },
      };
    } else {
      input = {
        ...input,
        KeyConditionExpression: "movieId = :m",
        ExpressionAttributeValues: { ":m": movieId },
      };
    }

    const castOut = await ddb.send(new QueryCommand(input));
    const response: any = { data: castOut.Items ?? [] };

    const includeFacts = typeof qs.facts === "string" && qs.facts.toLowerCase() === "true";
    if (includeFacts) {
      const getInput: GetCommandInput = {
        TableName: process.env.MOVIES_TABLE_NAME,
        Key: { id: movieId },
        ProjectionExpression: "#t, #g, #o",
        ExpressionAttributeNames: {
          "#t": "title",
          "#g": "genre_ids",
          "#o": "overview",
        },
      };
      const movieOut = await ddb.send(new GetCommand(getInput));
      if (movieOut.Item) {
        response.facts = movieOut.Item; 
      } else {
        response.facts = null;
      }
    }

    return json(200, response);
  } catch (err) {
    console.log("Error:", JSON.stringify(err));
    return json(500, { error: "Internal Server Error" });
  }
};

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function createDocumentClient() {
  const client = new DynamoDBClient({ region: process.env.REGION });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true },
    unmarshallOptions: { wrapNumbers: false },
  });
}
