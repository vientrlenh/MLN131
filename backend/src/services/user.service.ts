import { UserDocument, usersCollection } from "../models";

export async function createUser(nickname: string) {
    const now = new Date();
    const user: UserDocument = {
        nickname,
        createdAt: now,
        lastSeenAt: now,
    };
    const result = await usersCollection().insertOne(user);
    return result.insertedId;
}

export async function getUserByNickname(nickname: string) {
    return await usersCollection().findOne({
        nickname: nickname
    });
}
