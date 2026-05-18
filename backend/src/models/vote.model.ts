import type { Collection, ObjectId } from "mongodb";
import { getDb } from "../db";

export type VoteTargetType = "post" | "comment";
export type VoteValue = 1 | -1;

export interface VoteDocument {
  _id?: ObjectId;
  userId: ObjectId;
  targetType: VoteTargetType;
  targetId: ObjectId;
  value: VoteValue;
  createdAt: Date;
  updatedAt: Date;
}

export function votesCollection(): Collection<VoteDocument> {
  return getDb().collection<VoteDocument>("votes");
}
