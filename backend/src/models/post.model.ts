import type { Collection, ObjectId } from "mongodb";
import { getDb } from "../db";

export interface PostDocument {
  _id?: ObjectId;
  authorId: ObjectId;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export function postsCollection(): Collection<PostDocument> {
  return getDb().collection<PostDocument>("posts");
}
