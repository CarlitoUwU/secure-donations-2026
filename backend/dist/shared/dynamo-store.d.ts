import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Audit, Donation, Idempotency, Page, Project } from "./contracts.js";
import type { Store } from "./store.js";
export type Tables = {
    projects: string;
    donations: string;
    idempotency: string;
    audit: string;
};
export declare class DynamoStore implements Store {
    private tables;
    private client;
    constructor(tables: Tables, client?: DynamoDBDocumentClient);
    private get;
    project(id: string): Promise<Project | undefined>;
    donation(id: string): Promise<Donation | undefined>;
    idempotency(pk: string): Promise<Idempotency | undefined>;
    private query;
    projects(token?: string): Promise<Page<Project>>;
    donations(sub: string, token?: string): Promise<Page<Donation>>;
    private audit;
    private transact;
    createProject(p: Project, a: Audit): Promise<void>;
    updateProject(before: Project, after: Project, a: Audit): Promise<void>;
    createDonation(d: Donation, key: Idempotency, a: Audit): Promise<void>;
    transition(before: Donation, after: Donation, a: Audit): Promise<void>;
}
