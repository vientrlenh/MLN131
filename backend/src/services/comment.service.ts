import { ObjectId } from "mongodb";
import { CommentDocument, commentsCollection } from "../models";

export interface CommentWithAuthorNickname extends CommentDocument {
  authorNickname: string;
}

export async function getCommentsOnPost(postId: string): Promise<CommentWithAuthorNickname[]> {
  if (!ObjectId.isValid(postId)) {
    return [];
  }

  return commentsCollection()
    .aggregate<CommentWithAuthorNickname>([
      {
        $match: {
          postId: new ObjectId(postId),
          deletedAt: null,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "authorId",
          foreignField: "_id",
          as: "author",
        },
      },
      {
        $unwind: {
          path: "$author",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          authorNickname: {
            $ifNull: ["$author.nickname", "Unknown"],
          },
        },
      },
      {
        $project: {
          author: 0,
        },
      },
      {
        $sort: {
          createdAt: 1,
        },
      },
    ])
    .toArray();
}

export async function createComment(
  comment: Omit<CommentDocument, "_id" | "createdAt" | "updatedAt" | "deletedAt">,
) {
  const now = new Date();
  const result = await commentsCollection().insertOne({
    ...comment,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  return result.insertedId;
}
