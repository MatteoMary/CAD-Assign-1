import { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (): Promise<APIGatewayProxyResultV2> => {
  try {
    const tableName = process.env.TABLE_NAME!;
    let items: any[] = [];
    let ExclusiveStartKey: Record<string, any> | undefined = undefined;

    do {
      const out = await ddbDocClient.send(
        new ScanCommand({
          TableName: tableName,
          ExclusiveStartKey,
        })
      );
      if (out.Items) items = items.concat(out.Items);
      ExclusiveStartKey = out.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    return json(200, { data: items });
  } catch (error: any) {
    console.log("Error scanning table:", JSON.stringify(error));
    return json(500, { error: "Failed to scan table" });
  }
};

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = { wrapNumbers: false };
  return DynamoDBDocumentClient.from(ddbClient, { marshallOptions, unmarshallOptions });
}
