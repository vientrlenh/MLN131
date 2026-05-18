export * from "./user.model";
export * from "./post.model";
export * from "./comment.model";
export * from "./vote.model";

import { commentsCollection } from "./comment.model";
import { postsCollection } from "./post.model";
import { usersCollection } from "./user.model";
import { votesCollection } from "./vote.model";

export async function createModelIndexes() {
  await Promise.all([
    usersCollection().createIndex({ nickname: 1 }),
    postsCollection().createIndex({ createdAt: -1 }),
    postsCollection().createIndex({ authorId: 1, createdAt: -1 }),
    commentsCollection().createIndex({ postId: 1, createdAt: 1 }),
    commentsCollection().createIndex({ authorId: 1, createdAt: -1 }),
    votesCollection().createIndex(
      { userId: 1, targetType: 1, targetId: 1 },
      { unique: true },
    ),
    votesCollection().createIndex({ targetType: 1, targetId: 1 }),
  ]);
}
