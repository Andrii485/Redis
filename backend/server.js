const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const redis = require("redis");
const { performance } = require("perf_hooks");

const app = express();
app.use(bodyParser.json());
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "http://localhost:3000",
    ],
  })
);

const PORT = 3000;
const MONGO_URI =
  "mongodb+srv://andrejburak685_db_user:XercnrVSryhchXBG@cinemaplatrorm.e9l72c5.mongodb.net/CinemaPlatform?retryWrites=true&w=majority";
const REDIS_URL = "redis://localhost:6380";
const JWT_SECRET = "my_cinema_platform_secret";
const TTL = 60;


const formatTime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const milliseconds = Math.floor(ms % 1000);
  return `${seconds}s.${milliseconds.toString().padStart(3, "0")}ms`;
};


class SafeRedis {
  constructor(url) {
    this.url = url;
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.wasConnected = false;
    this.connect();
  }

  connect() {
    if (this.isConnecting || (this.client && this.client.isOpen)) {
      return;
    }

    this.isConnecting = true;
    const client = redis.createClient({ url: this.url });

    client.on("error", (err) => {
      if (this.isConnected) {
        console.error("Redis відключено: ", err.message);
      }
      this.isConnected = false;
      this.isConnecting = false;
      this.client = null;
    });

    client.on("connect", () => {});

    client.on("ready", () => {
      if (!this.wasConnected) {
        console.log("Redis підключено");
        this.wasConnected = true;
      }
      this.isConnected = true;
      this.isConnecting = false;
    });

    client.on("reconnecting", () => {});

    client
      .connect()
      .then(() => {
        this.client = client;
      })
      .catch((err) => {
        console.warn(
          "Початкове підключення Redis не вдалося. Робота через MongoDB."
        );
        this.isConnected = false;
        this.isConnecting = false;
        this.client = null;
        this.wasConnected = false;
      });
  }

  async performRedisOperation(operation, key, ...args) {
    if (!this.isConnected || !this.client || !this.client.isOpen) {
      this.connect();
      if (!this.isConnected || !this.client || !this.client.isOpen) {
        if (operation === "get") {
          return null;
        }
        return;
      }
    }

    try {
      const startTime = performance.now();
      let data;
      switch (operation) {
        case "get":
          data = await this.client.get(key);
          break;
        case "setEx":
          data = await this.client.setEx(key, args[0], args[1]);
          break;
        case "del":
          data = await this.client.del(key);
          break;
        default:
          throw new Error(`Невідома операція Redis: ${operation}`);
      }
      const endTime = performance.now();
      const time = formatTime(endTime - startTime);
      console.log(`Redis ${operation} ${key}: ${time}`);
      return { data, time };
    } catch (err) {
      this.isConnected = false;
      this.isConnecting = false;
      this.client = null;
      this.wasConnected = false;
      console.error(
        `Помилка Redis ${operation} (перехід на MongoDB): ${err.message}`
      );
      if (operation === "get") {
        return null;
      }
    }
  }

  async get(key) {
    return this.performRedisOperation("get", key);
  }

  async setEx(key, ttl, value) {
    return this.performRedisOperation("setEx", key, ttl, value);
  }

  async del(key) {
    return this.performRedisOperation("del", key);
  }
}

const redisClient = new SafeRedis(REDIS_URL);

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("MongoDB Atlas підключено до CinemaPlatform"))
  .catch((err) => console.error("Помилка підключення до MongoDB:", err));

mongoose.connection.on("open", async () => {
  try {
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    console.log(
      "Доступні колекції:",
      collections.map((c) => c.name)
    );
    const postCount = await mongoose.connection.db
      .collection("posts")
      .countDocuments();
    const commentCount = await mongoose.connection.db
      .collection("comments")
      .countDocuments();
    const userCount = await mongoose.connection.db
      .collection("users")
      .countDocuments();
    console.log(
      `Кількість документів: Posts=${postCount}, Comments=${commentCount}, Users=${userCount}`
    );
  } catch (err) {
    console.error("Помилка перевірки колекцій:", err);
  }
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  full_name: { type: String },
  password: { type: String, required: true },
  created_at: Date,
});
const User = mongoose.model("User", UserSchema);

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  authors: [{ type: mongoose.Types.ObjectId, ref: "User" }],
  category: { type: String },
  tags: [{ type: String }],
  media: { type: { type: String }, url: { type: String } },
  created_at: Date,
  updated_at: Date,
});
const Post = mongoose.model("Post", PostSchema);

const CommentSchema = new mongoose.Schema({
  post_id: { type: mongoose.Types.ObjectId, ref: "Post", required: true },
  author_id: { type: mongoose.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  parent_id: { type: mongoose.Types.ObjectId, default: null, ref: "Comment" },
  created_at: Date,
});
const Comment = mongoose.model("Comment", CommentSchema);

const verifyToken = (req, res, next) => {
  let token = req.headers["authorization"];
  if (!token) return res.status(401).json({ error: "Немає токена" });

  if (token.startsWith("Bearer ")) {
    token = token.slice(7, token.length).trim();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error("Помилка JWT:", err.message);
    res.status(401).json({ error: "Недійсний токен" });
  }
};

app.post("/users/register", async (req, res) => {
  const startTime = performance.now();
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      created_at: new Date(),
    });
    await newUser.save();
    const endTime = performance.now();
    const time = formatTime(endTime - startTime);
    console.log(`Реєстрація користувача ${username}: ${time}`);
    res.status(201).json({ message: "Користувач зареєстрований", time });
  } catch (err) {
    console.error("Помилка реєстрації:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/users/login", async (req, res) => {
  const startTime = performance.now();
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.log(`Невдалий логін для ${username}`);
      const endTime = performance.now();
      const time = formatTime(endTime - startTime);
      return res.status(401).json({ error: "Неправильні дані", time });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });
    const endTime = performance.now();
    const time = formatTime(endTime - startTime);
    console.log(`Успішний логін: ${username}, ${time}`);
    res.json({ token, userId: user._id, username: user.username, time });
  } catch (err) {
    console.error("Помилка логіну:", err);
    res.status(500).json({ error: err.message });
  }
});


app.post("/posts", verifyToken, async (req, res) => {
  const startTime = performance.now();
  try {
    const post = new Post({
      ...req.body,
      authors: [req.userId],
      created_at: new Date(),
      updated_at: new Date(),
    });
    await post.save();

    // Write-through: Оновлюємо кеш для категорії та тегів
    const categoryKey = `posts_category_${req.body.category || "all"}`;
    const query = req.body.category ? { category: req.body.category } : {};
    let posts = await Post.find(query).sort({ created_at: -1 });
    await redisClient.setEx(categoryKey, TTL, JSON.stringify(posts));

    if (req.body.tags) {
      for (const tag of req.body.tags) {
        const tagKey = `posts_tag_${tag}`;
        const tagPosts = await Post.find({ tags: tag }).sort({
          created_at: -1,
        });
        await redisClient.setEx(tagKey, TTL, JSON.stringify(tagPosts));
      }
    }

    const endTime = performance.now();
    const time = formatTime(endTime - startTime);
    console.log(`Додано пост: ${post.title}, ${time}`);
    res.status(201).json({ post, time });
  } catch (err) {
    console.error("Помилка додавання поста:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/posts", async (req, res) => {
  const { category, tag } = req.query;
  const cacheKey = `posts_${category || "all"}_${tag || "none"}`;
  console.log(
    `Запит до /posts: category=${category}, tag=${tag}, cacheKey=${cacheKey}`
  );

  try {
    let posts;
    let fromCache = false;
    let time;

    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult && cachedResult.data) {
      posts = JSON.parse(cachedResult.data);
      fromCache = true;
      time = cachedResult.time;
      console.log(`Дані з Redis: ${posts.length} постів, ${time}`);
      return res.json({ posts, fromCache, time });
    }

    const startTime = performance.now();
    const query = {};
    if (category) query.category = category;
    if (tag) query.tags = tag;
    posts = await Post.find(query).sort({ created_at: -1 });
    const endTime = performance.now();
    time = formatTime(endTime - startTime);
    console.log(`Дані з MongoDB: ${posts.length} постів, ${time}`);

    if (posts.length > 0) {
      await redisClient.setEx(cacheKey, TTL, JSON.stringify(posts));
    } else {
      console.log("Немає постів для кешування");
    }
    res.json({ posts, fromCache, time });
  } catch (err) {
    console.error("Помилка пошуку постів:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/posts/:id", verifyToken, async (req, res) => {
  const startTime = performance.now();
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);

    if (!post) {
      const endTime = performance.now();
      const time = formatTime(endTime - startTime);
      return res.status(404).json({ error: "Пост не знайдено", time });
    }

    const isAuthor = post.authors.some(
      (authorId) => authorId.toString() === req.userId
    );
    if (!isAuthor) {
      const endTime = performance.now();
      const time = formatTime(endTime - startTime);
      return res
        .status(403)
        .json({ error: "Не ваш пост. Ви не маєте права на видалення", time });
    }

    await Post.findByIdAndDelete(postId);
    await Comment.deleteMany({ post_id: postId });

    const categoryKey = `posts_category_${post.category || "all"}`;
    let posts = await Post.find({ category: post.category || null }).sort({
      created_at: -1,
    });
    await redisClient.setEx(categoryKey, TTL, JSON.stringify(posts));

    if (post.tags) {
      for (const tag of post.tags) {
        const tagKey = `posts_tag_${tag}`;
        const tagPosts = await Post.find({ tags: tag }).sort({
          created_at: -1,
        });
        await redisClient.setEx(tagKey, TTL, JSON.stringify(tagPosts));
      }
    }
    await redisClient.del(`comments_${postId}`);

    const endTime = performance.now();
    const time = formatTime(endTime - startTime);
    console.log(`Видалено пост: ${post.title}, ${time}`);
    res.json({ message: "Пост видалено", time });
  } catch (err) {
    console.error("Помилка видалення поста:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/comments", verifyToken, async (req, res) => {
  const startTime = performance.now();
  try {
    const comment = new Comment({
      ...req.body,
      author_id: req.userId,
      created_at: new Date(),
    });
    await comment.save();

    // Write-through: Оновлюємо кеш коментарів
    const cacheKey = `comments_${req.body.post_id}`;
    const comments = await Comment.aggregate([
      { $match: { post_id: new mongoose.Types.ObjectId(req.body.post_id) } },
      {
        $lookup: {
          from: "users",
          localField: "author_id",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          content: 1,
          parent_id: 1,
          created_at: 1,
          "author.username": 1,
          author_id: 1,
        },
      },
    ]);
    await redisClient.setEx(cacheKey, TTL, JSON.stringify(comments));

    const endTime = performance.now();
    const time = formatTime(endTime - startTime);
    console.log(`Додано коментар до поста ${req.body.post_id}, ${time}`);
    res.status(201).json({ comment, time });
  } catch (err) {
    console.error("Помилка додавання коментаря:", err);
    res.status(500).json({ error: err.message });
  }
});

// Пошук коментарів (cache-aside)
app.get("/comments/:postId", async (req, res) => {
  const cacheKey = `comments_${req.params.postId}`;
  console.log(`Запит до /comments/${req.params.postId}, cacheKey=${cacheKey}`);

  try {
    let comments;
    let fromCache = false;
    let time;

    // Спроба отримати з Redis
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult && cachedResult.data) {
      comments = JSON.parse(cachedResult.data);
      fromCache = true;
      time = cachedResult.time;
      console.log(`Дані з Redis: ${comments.length} коментарів, ${time}`);
      return res.json({ comments, fromCache, time });
    }

    // Запит до MongoDB
    const startTime = performance.now();
    comments = await Comment.aggregate([
      { $match: { post_id: new mongoose.Types.ObjectId(req.params.postId) } },
      {
        $lookup: {
          from: "users",
          localField: "author_id",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          content: 1,
          parent_id: 1,
          created_at: 1,
          "author.username": 1,
          author_id: 1,
        },
      },
    ]);
    const endTime = performance.now();
    time = formatTime(endTime - startTime);
    console.log(`Дані з MongoDB: ${comments.length} коментарів, ${time}`);

    if (comments.length > 0) {
      await redisClient.setEx(cacheKey, TTL, JSON.stringify(comments));
    } else {
      console.log("Немає коментарів для кешування");
    }
    res.json({ comments, fromCache, time });
  } catch (err) {
    console.error("Помилка пошуку коментарів:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/comments/:id", verifyToken, async (req, res) => {
  const startTime = performance.now();
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment || comment.author_id.toString() !== req.userId) {
      const endTime = performance.now();
      const time = formatTime(endTime - startTime);
      return res.status(403).json({ error: "Не ваш коментар", time });
    }

    await Comment.findByIdAndDelete(req.params.id);

    // Write-through: Оновлюємо кеш коментарів
    const cacheKey = `comments_${comment.post_id}`;
    const comments = await Comment.aggregate([
      { $match: { post_id: new mongoose.Types.ObjectId(comment.post_id) } },
      {
        $lookup: {
          from: "users",
          localField: "author_id",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          content: 1,
          parent_id: 1,
          created_at: 1,
          "author.username": 1,
          author_id: 1,
        },
      },
    ]);
    await redisClient.setEx(cacheKey, TTL, JSON.stringify(comments));

    const endTime = performance.now();
    const time = formatTime(endTime - startTime);
    console.log(`Видалено коментар: ${req.params.id}, ${time}`);
    res.json({ message: "Коментар видалено", time });
  } catch (err) {
    console.error("Помилка видалення коментаря:", err);
    res.status(500).json({ error: err.message });
  }
});


app.get("/clear-cache", async (req, res) => {
  const startTime = performance.now();
  try {
    if (
      redisClient.isConnected &&
      redisClient.client &&
      redisClient.client.isOpen
    ) {
      await redisClient.client.flushAll();
      console.log("Кеш Redis повністю очищено.");
    } else {
      console.log("Redis відключено. Кеш не очищено.");
    }

    const endTime = performance.now();
    const time = formatTime(endTime - startTime);
    console.log(`Кеш очищено, ${time}`);
    res.json({ message: "Кеш очищено", time });
  } catch (err) {
    console.error("Помилка очищення кеша:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "Сервер працює",
    mongodbConnected: mongoose.connection.readyState === 1,
    redisConnected: redisClient.isConnected,
  });
});

app.listen(PORT, () => console.log(`Сервер на порту ${PORT}`));
