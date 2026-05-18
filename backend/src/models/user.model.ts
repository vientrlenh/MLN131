import type { Collection, ObjectId } from "mongodb";
import { getDb } from "../db";

export interface UserDocument {
  _id?: ObjectId;
  nickname: string;
  createdAt: Date;
  lastSeenAt: Date;
}

export function usersCollection(): Collection<UserDocument> {
  return getDb().collection<UserDocument>("users");
}
