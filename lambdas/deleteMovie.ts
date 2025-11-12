import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION }),
  {
    marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true },
    unmarshallOptions: { wrapNumbers: false },
  }
);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[DELETE MOVIE EVENT]", JSON.stringify({
      path: event.rawPath,
      params: event.pathParameters,
      headers: {
        hasApiKey: Boolean(event.headers?.["x-api-key"] || event.headers?.["X-Api-Key"]),
      },
    }));

    const idStr = event.pathParameters?.movieId;
    if (!idStr) return json(400, { message: "Missing path parameter 'movieId'" });

    const id = Number(idStr);
    if (!Number.isFinite(id)) return json(400, { message: "Invalid 'movieId' (number expected)" });

    try {
      await ddb.send(new DeleteCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id },
        ConditionExpression: "attribute_exists(#id)",
        ExpressionAttributeNames: { "#id": "id" },
      }));
    } catch (err: any) {
      console.error("[DELETE ERROR]", err);
      if (err?.name === "ConditionalCheckFailedException") {
        return json(404, { message: `Movie ${id} not found` });
      }
      return json(500, { message: "Failed to delete movie" });
    }

    return json(200, { message: "Delete successful", id });
  } catch (err) {
    console.error("[UNHANDLED DELETE ERROR]", err);
    return json(500, { message: "Internal Server Error" });
  }
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
