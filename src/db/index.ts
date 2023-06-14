import { Filter } from 'nostr-tools';
import { NostrEvent } from '../ident';

declare module '.' {
    export function connectDb(): ArcadeDb;
    export class ArcadeDb {
        list(filter: Filter[]): Promise<NostrEvent[]>;
        latest(filter: Filter[]): Promise<number>;
        saveEvent(ev: NostrEvent): Promise<DbEvent>;
        flush(): Promise<void>;
    }
    export class DbEvent {
       event_id: string;
        content: string;
        sig: string;
        kind: number;
        pubkey: string;
        tags: string[][];
        created_at: number;
        verified: boolean;
        e1: string;
        p1: string;
        static fromEvent: (db: ArcadeDb, event: NostrEvent, verified?: boolean) => Promise<DbEvent>;
        asEvent: () => NostrEvent;
    }
}

type DbModule = {
    connectDb: () => ArcadeDb;
    ArcadeDb: new () => ArcadeDb;
    DbEvent: new () => DbEvent;
}

try {
    const db: DbModule = require('./base')  // eslint-disable-line @typescript-eslint/no-var-requires
    exports.connectDb = db.connectDb
    exports.ArcadeDb = db.ArcadeDb
    exports.DbEvent = db.DbEvent
} catch (e) {
    exports.connectDb = ()=>{throw Error("missing peer dep")}
    exports.ArcadeDb = ()=>{throw Error("missing peer dep")}
    exports.DbEvent = ()=>{throw Error("missing peer dep")}
}
