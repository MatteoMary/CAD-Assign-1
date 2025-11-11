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
    console.log("[EVENT]", JSON.stringify(event));

    const idStr = event.pathParameters?.movieId;
    const id = idStr ? parseInt(idStr, 10) : NaN;
    if (!Number.isFinite(id)) {
      return json(400, { message: "Invalid or missing path parameter 'movieId' (number expected)" });
    }

    try {
      await ddb.send(
        new DeleteCommand({
          TableName: process.env.TABLE_NAME,
          Key: { id },
          ConditionExpression: "attribute_exists(id)",
        })
      );
    } catch (err: any) {
      if (err?.name === "ConditionalCheckFailedException") {
        return json(404, { message: `Movie ${id} not found` });
      }
      console.error("Delete error:", err);
      return json(500, { message: "Failed to delete movie" });
    }

    return json(200, { message: "Delete successful", id });
  } catch (err) {
    console.error("Unhandled error:", err);
    return json(500, { message: "Internal Server Error" });
  }
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
