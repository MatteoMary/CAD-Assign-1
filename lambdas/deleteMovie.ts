import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

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

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": "true",
  },
  body: JSON.stringify(body),
});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    console.log("[DELETE MOVIE EVENT]", JSON.stringify(event));

    const adminKeyId =
      event.requestContext?.identity?.apiKeyId ||
      event.headers?.["x-api-key"] ||
      "admin";

    const idStr = event.pathParameters?.movieId;
    const movieId = idStr ? Number(idStr) : NaN;
    if (!Number.isFinite(movieId)) {
      return json(400, {
        message: "Invalid or missing path parameter 'movieId' (number expected)",
      });
    }

    try {
      await ddb.send(
        new DeleteCommand({
          TableName: process.env.TABLE_NAME,
          Key: { PK: `m${movieId}`, SK: "xxxx" },
          ConditionExpression: "attribute_exists(PK)",
        })
      );
    } catch (err: any) {
      if (err?.name === "ConditionalCheckFailedException") {
        return json(404, { message: `Movie ${movieId} not found` });
      }
      console.error("[DELETE MOVIE ERROR]", err);
      return json(500, { message: "Failed to delete movie" });
    }

    console.log(`admin(${adminKeyId}) /movies/${movieId} DELETE`);

    return json(200, { message: "Delete successful", movieId });
  } catch (err: any) {
    console.error("[DELETE MOVIE UNHANDLED]", err);
    return json(500, { message: "Internal Server Error" });
  }
};
