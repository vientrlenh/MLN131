import { ObjectId } from "mongodb";
import { VoteDocument, VoteTargetType, votesCollection } from "../models";

export interface VoteSummary {
  upvotes: number;
  downvotes: number;
  score: number;
  total: number;
}

export async function getVotesOnPost(postId: string): Promise<VoteSummary> {
  if (!ObjectId.isValid(postId)) {
    return {
      upvotes: 0,
      downvotes: 0,
      score: 0,
      total: 0,
    };
  }

  const [summary] = await votesCollection()
    .aggregate<VoteSummary>([
      {
        $match: {
          targetType: "post",
          targetId: new ObjectId(postId),
        },
      },
      {
        $group: {
          _id: null,
          upvotes: {
            $sum: {
              $cond: [{ $eq: ["$value", 1] }, 1, 0],
            },
          },
          downvotes: {
            $sum: {
              $cond: [{ $eq: ["$value", -1] }, 1, 0],
            },
          },
          score: { $sum: "$value" },
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          upvotes: 1,
          downvotes: 1,
          score: 1,
          total: 1,
        },
      },
    ])
    .toArray();

  return summary ?? {
    upvotes: 0,
    downvotes: 0,
    score: 0,
    total: 0,
  };
}

export async function getUserVoteOnPost(postId: string, userId?: string) {
  if (!userId || !ObjectId.isValid(postId) || !ObjectId.isValid(userId)) {
    return null;
  }

  const vote = await votesCollection().findOne({
    userId: new ObjectId(userId),
    targetType: "post",
    targetId: new ObjectId(postId),
  });

  return vote?.value ?? null;
}

export async function upsertVote(vote: Omit<VoteDocument, "_id" | "createdAt" | "updatedAt">) {
  const now = new Date();

  await votesCollection().updateOne(
    {
      userId: vote.userId,
      targetType: vote.targetType,
      targetId: vote.targetId,
    },
    {
      $set: {
        value: vote.value,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

export async function removeVote(userId: ObjectId, targetType: VoteTargetType, targetId: ObjectId) {
  await votesCollection().deleteOne({
    userId,
    targetType,
    targetId,
  });
}
