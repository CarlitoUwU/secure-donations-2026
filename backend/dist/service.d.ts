import type { Identity } from "./shared/contracts.js";
import type { Store } from "./shared/store.js";
export declare const operations: readonly ["listProjects", "getProject", "projectStats", "createProject", "editProject", "publishProject", "createDonation", "simulateDonation", "myDonations", "getDonation"];
export type Operation = (typeof operations)[number];
export declare const permissions: Partial<Record<Operation, {
    group: string;
    scope: string;
}>>;
export type Input = {
    identity?: Identity;
    body?: unknown;
    id?: string;
    key?: string;
    nextToken?: string;
    requestId: string;
    stage: string;
};
export declare class Service {
    private store;
    constructor(store: Store);
    execute(op: Operation, input: Input): Promise<{
        status: number;
        body: unknown;
    }>;
}
