// lambdas/getMovieById.ts
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION }),
  {
    marshallOptions: {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
    unmarshallOptions: { wrapNumbers: false },
  }
);

function json(status: number, body: unknown) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {

    const movieIdStr =
      event.pathParameters?.movieId ??
      event.queryStringParameters?.movieId ??
      null;

    if (!movieIdStr) return json(400, { message: "Missing movieId (path or query)" });

    const movieId = Number(movieIdStr);
    if (!Number.isFinite(movieId)) return json(400, { message: "Invalid movieId" });

    const out = await ddb.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: movieId },
      })
    );

    if (!out.Item) return json(404, { message: "Movie not found" });

    return json(200, { data: out.Item });
  } catch (err: any) {
    console.error("GetMovieById error", {
      name: err?.name,
      message: err?.message,
      meta: err?.$metadata,
      stack: err?.stack,
    });
    return json(500, { error: err?.name || "InternalError", message: err?.message || "Internal Server Error" });
  }
};
