import express from "express";
import { ObjectId } from "mongodb";
import connect from "./db";
import { createModelIndexes } from "./models";
import { createPost, createUser, getUserByNickname, listPostsWithVotes, upsertVote } from "./services";


const app = express();
const PORT = 3000;

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

    if (value !== 1 && value !== -1) {
        res.status(400).send({ message: "Giá trị bình chọn phải là 1 hoặc -1" });
        return;
    }

    await upsertVote({
        userId: new ObjectId(userId),
        targetType: "post",
        targetId: new ObjectId(postId),
        value,
    });

    res.status(204).send();
});

async function startServer() {
    await connect();
    await createModelIndexes();

    app.listen(PORT, () => {
        console.log(`Running at port: ${PORT}`)
    });
}

startServer().catch((err) => {
    console.error(err);
    process.exit(1);
});
