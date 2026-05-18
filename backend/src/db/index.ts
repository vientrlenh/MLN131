import { Db, MongoClient } from "mongodb";

const url = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const client = new MongoClient(url);
let db: Db | null = null;

export default async function connect() {
    try {
        await client.connect();
        db = client.db('mln131');
        return db;
    } catch (err) {
        console.error(err);
        throw err;
    }
}

export function getDb(): Db {
    if (!db) {
        throw new Error("Database is not connected. Call connect() before using collections.");
    }

    return db;
}
