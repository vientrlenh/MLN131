import { ObjectId } from "mongodb";
import { PostDocument, postsCollection, VoteValue } from "../models";
import { getUserVoteOnPost, getVotesOnPost, VoteSummary } from "./vote.service";

export interface PostListOptions {
  limit?: number;
  skip?: number;
  viewerUserId?: string;
}

export interface PostWithAuthorNickname extends PostDocument {
  authorNickname: string;
}

export async function listPosts(options: PostListOptions = {}): Promise<PostWithAuthorNickname[]> {
  const limit = options.limit ?? 20;
  const skip = options.skip ?? 0;

  return postsCollection()
    .aggregate<PostWithAuthorNickname>([
      {
        $match: {
          deletedAt: null,
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
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
    ])
    .toArray();
}

export interface PostWithVotes extends PostWithAuthorNickname {
  votes: VoteSummary;
  currentUserVote: VoteValue | null;
}

export async function listPostsWithVotes(options: PostListOptions = {}): Promise<PostWithVotes[]> {
  const posts = await listPosts(options);

  return Promise.all(
    posts.map(async (post) => ({
      ...post,
      votes: await getVotesOnPost(post._id?.toString() ?? ""),
      currentUserVote: await getUserVoteOnPost(post._id?.toString() ?? "", options.viewerUserId),
    })),
  );
}

export async function getPostDetails(postId: string) {
  if (!ObjectId.isValid(postId)) {
    return null;
  }

  return postsCollection().findOne({
    _id: new ObjectId(postId),
    deletedAt: null,
  });
}

export async function createPost(post: Omit<PostDocument, "_id" | "createdAt" | "updatedAt" | "deletedAt">) {
  const now = new Date();
  const result = await postsCollection().insertOne({
    ...post,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  return result.insertedId;
}
