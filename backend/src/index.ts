import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { ObjectId } from "mongodb";
import connect from "./db";
import { createModelIndexes } from "./models";
import { createPost, createUser, getUserByNickname, listPostsWithVotes, upsertVote, removeVote, getPostDetails, getCommentsOnPost, createComment, getVotesOnPost, getUserVoteOnPost } from "./services";
import { usersCollection } from "./models";
import { initWebSocket, broadcast } from "./ws";


const app = express();
const server = createServer(app);
const PORT = Number(process.env.PORT ?? 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/", (req, res) => {
    res.send({
        "status": "Đang hoạt động"
    });
});

app.get("/api/posts", async (req, res) => {
    const limit = Number(req.query.limit ?? 20);
    const skip = Number(req.query.skip ?? 0);
    const viewerUserId = String(req.query.userId ?? "").trim();
    const options = {
        limit,
        skip,
        ...(ObjectId.isValid(viewerUserId) ? { viewerUserId } : {}),
    };
    const posts = await listPostsWithVotes(options);

    res.send(posts);
});

app.post("/api/users", async (req, res) => {
    const nickname = String(req.body?.nickname ?? "").trim();

    if (!nickname) {
        res.status(400).send({ message: "Biệt danh là bắt buộc" });
        return;
    }

    if (nickname.length > 32) {
        res.status(400).send({ message: "Biệt danh không được vượt quá 32 ký tự" });
        return;
    }
    const existingUser = await getUserByNickname(nickname);
    if (existingUser) {
        res.status(400).send({ message: "Nguời dùng với biệt danh này đã tồn tại" });
        return;
    }
    const userId = await createUser(nickname);
    res.status(201).send({ id: userId, nickname });
});

app.post("/api/posts", async (req, res) => {
    const authorId = String(req.body?.authorId ?? "").trim();
    const title = String(req.body?.title ?? "").trim();
    const body = String(req.body?.body ?? "").trim();

    if (!ObjectId.isValid(authorId)) {
        res.status(400).send({ message: "Tác giả hợp lệ là bắt buộc" });
        return;
    }

    if (!title) {
        res.status(400).send({ message: "Tiêu đề là bắt buộc" });
        return;
    }

    if (!body) {
        res.status(400).send({ message: "Nội dung là bắt buộc" });
        return;
    }

    if (title.length > 120) {
        res.status(400).send({ message: "Tiêu đề không được vượt quá 120 ký tự" });
        return;
    }

    const postId = await createPost({
        authorId: new ObjectId(authorId),
        title,
        body,
    });

    broadcast({ type: "new_post", payload: { postId: postId.toString() } });
    res.status(201).send({ id: postId });
});

app.post("/api/posts/:postId/votes", async (req, res) => {
    const postId = String(req.params.postId ?? "").trim();
    const userId = String(req.body?.userId ?? "").trim();
    const value = Number(req.body?.value);

    if (!ObjectId.isValid(postId)) {
        res.status(400).send({ message: "Bài đăng hợp lệ là bắt buộc" });
        return;
    }

    if (!ObjectId.isValid(userId)) {
        res.status(400).send({ message: "Người dùng hợp lệ là bắt buộc" });
        return;
    }

    if (value !== 1 && value !== -1 && value !== 0) {
        res.status(400).send({ message: "Giá trị bình chọn phải là 1, -1 hoặc 0" });
        return;
    }

    if (value === 0) {
        await removeVote(new ObjectId(userId), "post", new ObjectId(postId));
    } else {
        await upsertVote({
            userId: new ObjectId(userId),
            targetType: "post",
            targetId: new ObjectId(postId),
            value,
        });
    }

    broadcast({ type: "new_vote", payload: { postId, userId } });
    res.status(204).send();
});

app.get("/api/posts/:postId", async (req, res) => {
    const postId = String(req.params.postId ?? "").trim();
    const viewerUserId = String(req.query.userId ?? "").trim();

    if (!ObjectId.isValid(postId)) {
        res.status(400).send({ message: "Bài đăng không hợp lệ" });
        return;
    }

    const post = await getPostDetails(postId);
    if (!post) {
        res.status(404).send({ message: "Không tìm thấy bài đăng" });
        return;
    }

    const votes = await getVotesOnPost(postId);
    const currentUserVote = ObjectId.isValid(viewerUserId)
        ? await getUserVoteOnPost(postId, viewerUserId)
        : null;

    const author = await usersCollection().findOne({ _id: post.authorId });
    const authorNickname = author?.nickname ?? "Unknown";

    res.send({ ...post, authorNickname, votes, currentUserVote });
});

app.get("/api/posts/:postId/comments", async (req, res) => {
    const postId = String(req.params.postId ?? "").trim();

    if (!ObjectId.isValid(postId)) {
        res.status(400).send({ message: "Bài đăng không hợp lệ" });
        return;
    }

    const comments = await getCommentsOnPost(postId);
    res.send(comments);
});

app.post("/api/posts/:postId/comments", async (req, res) => {
    const postId = String(req.params.postId ?? "").trim();
    const authorId = String(req.body?.authorId ?? "").trim();
    const body = String(req.body?.body ?? "").trim();

    if (!ObjectId.isValid(postId)) {
        res.status(400).send({ message: "Bài đăng không hợp lệ" });
        return;
    }

    if (!ObjectId.isValid(authorId)) {
        res.status(400).send({ message: "Tác giả hợp lệ là bắt buộc" });
        return;
    }

    if (!body) {
        res.status(400).send({ message: "Nội dung bình luận là bắt buộc" });
        return;
    }

    if (body.length > 2000) {
        res.status(400).send({ message: "Bình luận không được vượt quá 2000 ký tự" });
        return;
    }

    const commentId = await createComment({
        postId: new ObjectId(postId),
        authorId: new ObjectId(authorId),
        parentCommentId: null,
        body,
    });

    broadcast({ type: "new_comment", payload: { postId, commentId: commentId.toString() } });
    res.status(201).send({ id: commentId });
});

async function startServer() {
    await connect();
    await createModelIndexes();

    initWebSocket(server);

    server.listen(PORT, () => {
        console.log(`Running at port: ${PORT}`)
    });
}

startServer().catch((err) => {
    console.error(err);
    process.exit(1);
});
