import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, } from "@aws-sdk/lib-dynamodb";
import { ApiError, conflict } from "./contracts.js";
export class DynamoStore {
    tables;
    client;
    constructor(tables, client = DynamoDBDocumentClient.from(new DynamoDBClient({}))) {
        this.tables = tables;
        this.client = client;
    }
    async get(TableName, Key) {
        return (await this.client.send(new GetCommand({ TableName, Key, ConsistentRead: true }))).Item;
    }
    project(id) {
        return this.get(this.tables.projects, { projectId: id });
    }
    donation(id) {
        return this.get(this.tables.donations, { donationId: id });
    }
    idempotency(pk) {
        return this.get(this.tables.idempotency, { pk });
    }
    async query(TableName, IndexName, field, value, nextToken) {
        let ExclusiveStartKey;
        if (nextToken) {
            try {
                if (nextToken.length > 2048)
                    throw new Error();
                const parsed = JSON.parse(Buffer.from(nextToken, "base64url").toString("utf8"));
                const primary = field === "status" ? "projectId" : "donationId";
                if (!parsed ||
                    Object.keys(parsed).sort().join() !==
                        [primary, field, "createdAt"].sort().join() ||
                    Object.values(parsed).some((v) => typeof v !== "string") ||
                    parsed[field] !== value)
                    throw new Error();
                ExclusiveStartKey = parsed;
            }
            catch {
                throw new ApiError(400, "INVALID_CURSOR", "Cursor inválido");
            }
        }
        const result = await this.client.send(new QueryCommand({
            TableName,
            IndexName,
            KeyConditionExpression: "#field = :value",
            ExpressionAttributeNames: { "#field": field },
            ExpressionAttributeValues: { ":value": value },
            Limit: 50,
            ScanIndexForward: false,
            ExclusiveStartKey,
        }));
        return {
            items: (result.Items ?? []),
            ...(result.LastEvaluatedKey
                ? {
                    nextToken: Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64url"),
                }
                : {}),
        };
    }
    projects(token) {
        return this.query(this.tables.projects, "status-createdAt", "status", "PUBLICADO", token);
    }
    donations(sub, token) {
        return this.query(this.tables.donations, "donorSub-createdAt", "donorSub", sub, token);
    }
    audit(a) {
        return {
            Put: {
                TableName: this.tables.audit,
                Item: a,
                ConditionExpression: "attribute_not_exists(eventType) AND attribute_not_exists(sortKey)",
            },
        };
    }
    async transact(items) {
        try {
            await this.client.send(new TransactWriteCommand({ TransactItems: items }));
        }
        catch (error) {
            // Throttling, configuration and permission failures must not masquerade as business conflicts.
            const e = error;
            if (e.name === "TransactionCanceledException" &&
                e.CancellationReasons?.some((r) => ["ConditionalCheckFailed", "TransactionConflict"].includes(r.Code ?? "")))
                throw conflict();
            throw error;
        }
    }
    createProject(p, a) {
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
    updateProject(before, after, a) {
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
    createDonation(d, key, a) {
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
    transition(before, after, a) {
        const items = [
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
                    UpdateExpression: "SET updatedAt = :now ADD confirmedAmountCents :amount",
                    ConditionExpression: "attribute_exists(projectId) AND #s = :published AND confirmedAmountCents <= :maximum",
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
