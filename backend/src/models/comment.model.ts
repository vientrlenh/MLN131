import type { Collection, ObjectId } from "mongodb";
import { getDb } from "../db";

export interface CommentDocument {
  _id?: ObjectId;
  postId: ObjectId;
  authorId: ObjectId;
  parentCommentId: ObjectId | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export function commentsCollection(): Collection<CommentDocument> {
  return getDb().collection<CommentDocument>("comments");
}
