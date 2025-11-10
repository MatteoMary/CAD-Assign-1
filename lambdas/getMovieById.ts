import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

const ddb = createDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("Event:", JSON.stringify(event));

    const movieIdStr = event.pathParameters?.movieId;
    if (!movieIdStr) return json(400, { message: "Missing movieId parameter" });

    const movieId = Number(movieIdStr);
    if (!Number.isFinite(movieId)) return json(400, { message: "Invalid movieId" });

    const movieOut = await ddb.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: movieId },
      })
    );

    if (!movieOut.Item)
      return json(404, { message: "Movie not found" });

    const response: any = { data: movieOut.Item };

    const qs = event.queryStringParameters ?? {};
    const includeCast = typeof qs.cast === "string" && qs.cast.toLowerCase() === "true";

    if (includeCast) {
      const castInput: QueryCommandInput = {
        TableName: process.env.CAST_TABLE_NAME,
        KeyConditionExpression: "movieId = :m",
        ExpressionAttributeValues: { ":m": movieId },
      };

      const castOut = await ddb.send(new QueryCommand(castInput));
      response.cast = castOut.Items ?? [];
    }

    return json(200, response);
  } catch (err) {
    console.error("Error:", err);
    return json(500, { error: "Internal Server Error" });
  }
};

function createDocClient() {
  const client = new DynamoDBClient({ region: process.env.REGION });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true },
    unmarshallOptions: { wrapNumbers: false },
  });
}

function json(status: number, body: any) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
