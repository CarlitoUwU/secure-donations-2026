import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { ApiError, conflict } from "./contracts.js";
import type {
  Audit,
  Donation,
  Idempotency,
  Page,
  Project,
} from "./contracts.js";
import type { Store } from "./store.js";

export type Tables = {
  projects: string;
  donations: string;
  idempotency: string;
  audit: string;
};
export class DynamoStore implements Store {
  constructor(
    private tables: Tables,
    private client = DynamoDBDocumentClient.from(new DynamoDBClient({})),
  ) {}
  private async get<T>(
    TableName: string,
    Key: Record<string, string>,
  ): Promise<T | undefined> {
    return (
      await this.client.send(
        new GetCommand({ TableName, Key, ConsistentRead: true }),
      )
    ).Item as T | undefined;
  }
  project(id: string) {
    return this.get<Project>(this.tables.projects, { projectId: id });
  }
  donation(id: string) {
    return this.get<Donation>(this.tables.donations, { donationId: id });
  }
  idempotency(pk: string) {
    return this.get<Idempotency>(this.tables.idempotency, { pk });
  }
  private async query<T>(
    TableName: string,
    IndexName: string,
    field: string,
    value: string,
    nextToken?: string,
  ): Promise<Page<T>> {
    let ExclusiveStartKey: Record<string, string> | undefined;
    if (nextToken) {
      try {
        if (nextToken.length > 2048) throw new Error();
        const parsed = JSON.parse(
          Buffer.from(nextToken, "base64url").toString("utf8"),
        );
        const primary = field === "status" ? "projectId" : "donationId";
        if (
          !parsed ||
          Object.keys(parsed).sort().join() !==
            [primary, field, "createdAt"].sort().join() ||
          Object.values(parsed).some((v) => typeof v !== "string") ||
          parsed[field] !== value
        )
          throw new Error();
        ExclusiveStartKey = parsed;
      } catch {
        throw new ApiError(400, "INVALID_CURSOR", "Cursor inválido");
      }
    }
    const result = await this.client.send(
      new QueryCommand({
        TableName,
        IndexName,
        KeyConditionExpression: "#field = :value",
        ExpressionAttributeNames: { "#field": field },
        ExpressionAttributeValues: { ":value": value },
        Limit: 50,
        ScanIndexForward: false,
        ExclusiveStartKey,
      }),
    );
    return {
      items: (result.Items ?? []) as T[],
      ...(result.LastEvaluatedKey
        ? {
            nextToken: Buffer.from(
              JSON.stringify(result.LastEvaluatedKey),
            ).toString("base64url"),
          }
        : {}),
    };
  }
  projects(token?: string) {
    return this.query<Project>(
      this.tables.projects,
      "status-createdAt",
      "status",
      "PUBLICADO",
      token,
    );
  }
  donations(sub: string, token?: string) {
    return this.query<Donation>(
      this.tables.donations,
      "donorSub-createdAt",
      "donorSub",
      sub,
      token,
    );
  }
  private audit(a: Audit) {
    return {
      Put: {
        TableName: this.tables.audit,
        Item: a,
        ConditionExpression:
          "attribute_not_exists(eventType) AND attribute_not_exists(sortKey)",
      },
    };
  }
  private async transact(items: TransactWriteCommandInput["TransactItems"]) {
    try {
      await this.client.send(
        new TransactWriteCommand({ TransactItems: items }),
      );
    } catch (error) {
      // Throttling, configuration and permission failures must not masquerade as business conflicts.
      const e = error as {
        name?: string;
        CancellationReasons?: { Code?: string }[];
      };
      if (
        e.name === "TransactionCanceledException" &&
        e.CancellationReasons?.some((r) =>
          ["ConditionalCheckFailed", "TransactionConflict"].includes(
            r.Code ?? "",
          ),
        )
      )
        throw conflict();
      throw error;
    }
  }
  createProject(p: Project, a: Audit) {
    return this.transact([
      {
        Put: {
          TableName: this.tables.projects,
          Item: p,
          ConditionExpression: "attribute_not_exists(projectId)",
        },
      },
      this.audit(a),
    ]);
  }
  updateProject(before: Project, after: Project, a: Audit) {
    return this.transact([
      {
        Put: {
          TableName: this.tables.projects,
          Item: after,
          ConditionExpression: "#s = :draft AND revision = :revision",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":draft": "BORRADOR",
            ":revision": before.revision,
          },
        },
      },
      this.audit(a),
    ]);
  }
  createDonation(d: Donation, key: Idempotency, a: Audit) {
    return this.transact([
      {
        ConditionCheck: {
          TableName: this.tables.projects,
          Key: { projectId: d.projectId },
          ConditionExpression: "#s = :published",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":published": "PUBLICADO" },
        },
      },
      {
        Put: {
          TableName: this.tables.idempotency,
          Item: key,
          ConditionExpression: "attribute_not_exists(pk)",
        },
      },
      {
        Put: {
          TableName: this.tables.donations,
          Item: d,
          ConditionExpression: "attribute_not_exists(donationId)",
        },
      },
      this.audit(a),
    ]);
  }
  transition(before: Donation, after: Donation, a: Audit) {
    const items: NonNullable<TransactWriteCommandInput["TransactItems"]> = [
      {
        Update: {
          TableName: this.tables.donations,
          Key: { donationId: before.donationId },
          UpdateExpression: "SET #s = :next, updatedAt = :now",
          ConditionExpression: "#s = :pending AND donorSub = :sub",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":next": after.status,
            ":now": after.updatedAt,
            ":pending": "PENDIENTE_SIMULACION",
            ":sub": before.donorSub,
          },
        },
      },
      this.audit(a),
    ];
    if (after.status === "CONFIRMADA_SIMULADA")
      items.push({
        Update: {
          TableName: this.tables.projects,
          Key: { projectId: before.projectId },
          UpdateExpression:
            "SET updatedAt = :now ADD confirmedAmountCents :amount",
          ConditionExpression:
            "attribute_exists(projectId) AND #s = :published AND confirmedAmountCents <= :maximum",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":now": after.updatedAt,
            ":amount": before.amountCents,
            ":published": "PUBLICADO",
            ":maximum": Number.MAX_SAFE_INTEGER - before.amountCents,
          },
        },
      });
    return this.transact(items);
  }
}
