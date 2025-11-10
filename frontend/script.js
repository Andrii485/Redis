const API_URL = "http://localhost:3000";



const PostDetailPage = ({
  selectedPost,
  token,
  userId,
  lastRequestTime,
  setShowDeleteModal,
  setDeleteId,
  onBack,
  setIsLoading,
}) => {
  const [comments, setComments] = React.useState([]);
  const [isCommentsLoading, setIsCommentsLoading] = React.useState(false);

  // Завантаження коментарів при відкритті сторінки поста
  React.useEffect(() => {
    if (selectedPost) {
      loadComments(selectedPost._id);
    }
  }, [selectedPost]);

  const loadComments = async (postId) => {
    setIsCommentsLoading(true);
    try {
      const response = await fetch(`${API_URL}/comments/${postId}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      console.log("Отримані коментарі:", data);
      setComments(data.comments);
    } catch (err) {
      console.error("Помилка завантаження коментарів:", err);
      alert("Помилка: " + err);
    } finally {
      setIsCommentsLoading(false);
    }
  };

  // Додавання коментаря
  const handleAddComment = async (e) => {
    e.preventDefault();
    const content = e.target["comment-content"].value;
  
    const parentId = null; // Коментар завжди є основним (верхнього рівня)

    if (!token) return alert("Увійдіть, щоб коментувати");

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          post_id: selectedPost._id,
          content,
          parent_id: parentId, // Відправляємо null
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      console.log("Коментар додано:", data);
      alert("Коментар додано");
      loadComments(selectedPost._id); // Перезавантажуємо коментарі
    } catch (err) {
      console.error("Помилка додавання коментаря:", err);
      alert("Помилка: " + err);
    } finally {
      setIsLoading(false);
      e.target.reset();
    }
  };

  // Видалення коментаря
  const confirmCommentDelete = (commentId) => {
    setDeleteId(commentId);
    setShowDeleteModal("comment");
  };

  if (!selectedPost) return <p className="text-gray-300">Пост не знайдено.</p>;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl animate-fade-in w-full">
      <button
        onClick={onBack}
        className="text-blue-400 hover:text-blue-500 mb-4 flex items-center gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Назад до постів
      </button>

      {selectedPost.media?.url && (
        <img
          src={selectedPost.media.url}
          alt={selectedPost.title}
          className="w-full h-auto max-h-96 object-cover rounded-lg mb-4"
          onError={(e) => (e.target.style.display = "none")} // Приховуємо зображення у разі помилки завантаження
        />
      )}

      <h1 className="text-3xl font-bold text-white mb-2">
        {selectedPost.title}
      </h1>
      <p className="mt-2 text-gray-300 whitespace-pre-wrap">
        {selectedPost.content}
      </p>

      <p className="text-sm text-gray-400 mt-4 border-t border-gray-700 pt-2">
        Категорія: {selectedPost.category} | Теги:{" "}
        {selectedPost.tags?.join(", ") || "немає"}
        {lastRequestTime && ` | Час запиту: ${lastRequestTime}`}
      </p>

      {selectedPost.authors[0] === userId && (
        <button
          onClick={() => {
            setDeleteId(selectedPost._id);
            setShowDeleteModal("post");
          }}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
        >
          Видалити пост
        </button>
      )}

      {}
      <h2 className="text-2xl font-semibold text-white mt-6 mb-4 border-t border-gray-700 pt-4">
        Коментарі
      </h2>

      {isCommentsLoading ? (
        <p className="text-gray-400">Завантаження коментарів...</p>
      ) : comments.length === 0 ? (
        <p className="text-gray-300">Немає коментарів</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {comments.map((comment, index) => (
            <li
              key={comment._id}
              className={`p-3 rounded bg-gray-700 ${
                comment.parent_id
                  ? "ml-6 bg-gray-600 border-l-2 border-blue-500"
                  : ""
              } animate-fade-in`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex justify-between items-start">
                <p className="text-gray-200">{comment.content}</p>
                {comment.author_id === userId && (
                  <button
                    onClick={() => confirmCommentDelete(comment._id)}
                    className="ml-2 text-red-400 hover:text-red-500 transition-colors text-sm"
                  >
                    Видалити
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Автор: {comment.author?.username || "невідомий"}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Форма додавання коментаря */}
      {token && (
        <form
          onSubmit={handleAddComment}
          className="mt-6 space-y-4 border-t border-gray-700 pt-4"
        >
          <textarea
            name="comment-content"
            placeholder="Коментар"
            required
            className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {/* 🗑️ ВИДАЛЕНО: поле ID батьківського коментаря */}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors"
            disabled={isCommentsLoading}
          >
            {isCommentsLoading ? "Завантаження..." : "Додати коментар"}
          </button>
        </form>
      )}
    </div>
  );
};



const App = () => {
  const [token, setToken] = React.useState(
    localStorage.getItem("token") || null
  );
  const [userId, setUserId] = React.useState(
    localStorage.getItem("userId") || null
  );
  const [username, setUsername] = React.useState(
    localStorage.getItem("username") || ""
  );
  const [posts, setPosts] = React.useState([]);

  const [selectedPost, setSelectedPost] = React.useState(null);
  const [currentPage, setCurrentPage] = React.useState("home");

  const [category, setCategory] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(null);
  const [deleteId, setDeleteId] = React.useState(null);
  const [lastRequestTime, setLastRequestTime] = React.useState(null);

  // Завантаження постів
  React.useEffect(() => {
    if (currentPage === "home") {
      loadPosts();
    }
  }, [category, tag, currentPage]);

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const query = [];
      if (category) query.push(`category=${category}`);
      if (tag) query.push(`tag=${tag}`);
      const response = await fetch(
        `${API_URL}/posts${query.length ? "?" + query.join("&") : ""}`
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      console.log("Отримані пости:", data);
      setPosts(data.posts);
      setLastRequestTime(data.time);
    } catch (err) {
      console.error("Помилка завантаження постів:", err);
      alert("Помилка: " + err);
    } finally {
      setIsLoading(false);
    }
  };


  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const username = e.target["login-username"].value;
    const password = e.target["login-password"].value;
    try {
      const response = await fetch(`${API_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setToken(data.token);
      setUserId(data.userId);
      setUsername(data.username);
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("username", data.username);
      console.log("Логін успішний:", data);
      alert("Увійшли");
    } catch (err) {
      console.error("Помилка логіну:", err);
      alert("Помилка: " + err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const username = e.target["reg-username"].value;
    const email = e.target["reg-email"].value;
    const password = e.target["reg-password"].value;
    try {
      const response = await fetch(`${API_URL}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      console.log("Реєстрація успішна:", data);
      alert("Зареєстровано");
    } catch (err) {
      console.error("Помилка реєстрації:", err);
      alert("Помилка: " + err);
    } finally {
      setIsLoading(false);
    }
  };


  const handleLogout = () => {
    setToken(null);
    setUserId(null);
    setUsername("");
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
  };


  const handleAddPost = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const title = e.target.title.value;
    const content = e.target.content.value;
    const category = e.target.category.value;
    const tags = e.target.tags.value
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);
    const mediaUrl = e.target["media-url"].value;
    try {
      const response = await fetch(`${API_URL}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          content,
          category,
          tags,
          media: mediaUrl ? { type: "photo", url: mediaUrl } : undefined,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      console.log("Пост додано:", data);
      alert("Пост додано");
      loadPosts();
    } catch (err) {
      console.error("Помилка додавання поста:", err);
      alert("Помилка: " + err);
    } finally {
      setIsLoading(false);
      e.target.reset();
    }
  };


  const viewPost = (post) => {
    setSelectedPost(post);
    setCurrentPage("post");
  };


  const confirmDelete = async () => {
    setIsLoading(true);
    try {
      if (showDeleteModal === "post") {
        const response = await fetch(`${API_URL}/posts/${deleteId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        console.log("Пост видалено:", deleteId);
        alert("Пост видалено");
        setSelectedPost(null);
        setCurrentPage("home"); 
        loadPosts();
      } else if (showDeleteModal === "comment") {
        const response = await fetch(`${API_URL}/comments/${deleteId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        console.log("Коментар видалено:", deleteId);
        alert("Коментар видалено");
        // Оскільки PostDetailPage сам завантажує коментарі, просто оновлюємо сторінку поста
        const postToRefresh = posts.find((p) => p._id === selectedPost._id);
        setSelectedPost(postToRefresh); // тригер для PostDetailPage для перезавантаження коментарів
      }
    } catch (err) {
      console.error(`Помилка видалення ${showDeleteModal}:`, err);
      alert("Помилка: " + err);
    } finally {
      setShowDeleteModal(null);
      setDeleteId(null);
      setIsLoading(false);
    }
  };

  const renderHomePage = () => (
    <div className="w-full md:w-3/4 p-6">
      <h1 className="text-4xl font-extrabold text-white mb-6">Останні пости</h1>
      {isLoading && (
        <div className="flex justify-center">
          <p className="text-gray-400">Завантаження постів...</p>
        </div>
      )}
      {posts.length === 0 && !isLoading ? (
        <p className="text-gray-300">Немає постів для відображення</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post, index) => (
            <div
              key={post._id}
              className="bg-gray-700 rounded-lg shadow-lg hover:shadow-xl p-4 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => viewPost(post)}
            >
              {}
              {post.media?.url && (
                <img
                  src={post.media.url}
                  alt={post.title}
                  className="w-full h-40 object-cover rounded-t-lg mb-2"
                  onError={(e) => (e.target.style.display = "none")}
                />
              )}
              <h3 className="text-xl font-semibold text-blue-400 mb-1">
                {post.title}
              </h3>
              <p className="text-gray-300">
                {post.content.substring(0, 100)}...
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Категорія: {post.category} | Теги:{" "}
                {post.tags?.join(", ") || "немає"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Шапка */}
      <header className="bg-gray-800 shadow-md p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1
            className="text-2xl font-bold cursor-pointer text-blue-400 hover:text-blue-300"
            onClick={() => {
              setCurrentPage("home");
              setSelectedPost(null);
            }}
          >
            CinemaPlatform
          </h1>
          <div>
            {token ? (
              <div className="flex items-center gap-2">
                <span>Вітаємо, {username}</span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
                >
                  Вийти
                </button>
              </div>
            ) : (
              <span className="text-gray-400">Не авторизовано</span>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 flex flex-col md:flex-row gap-6">
        {/* Бічна панель (завжди відображається) */}
        <aside className="w-full md:w-1/4 bg-gray-800 p-6 rounded-lg shadow-lg self-start">
          <h2 className="text-xl font-semibold mb-4 text-white">Фільтри</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCurrentPage("home");
              loadPosts();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium">Категорія:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Всі</option>
                <option value="review">Рецензії</option>
                <option value="news">Новини</option>
                <option value="awards">Обговорення</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Тег:</label>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                type="text"
                placeholder="Тег (напр., фантастика)"
                className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors"
              disabled={isLoading}
            >
              {isLoading ? "Завантаження..." : "Фільтрувати"}
            </button>
          </form>

          {/* Форми авторизації та додавання поста (винесено для чистоти) */}
          <h2 className="text-xl font-semibold mb-4 mt-6 text-white border-t border-gray-700 pt-4">
            Акаунт
          </h2>
          {!token ? (
            <>
              <h3 className="text-lg font-medium mt-4">Реєстрація</h3>
              <form onSubmit={handleRegister} className="space-y-4">
                <input
                  name="reg-username"
                  type="text"
                  placeholder="Ім'я користувача"
                  required
                  className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
                />
                <input
                  name="reg-email"
                  type="email"
                  placeholder="Email"
                  required
                  className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
                />
                <input
                  name="reg-password"
                  type="password"
                  placeholder="Пароль"
                  required
                  className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white p-2 rounded transition-colors"
                  disabled={isLoading}
                >
                  {isLoading ? "Завантаження..." : "Зареєструватися"}
                </button>
              </form>

              <h3 className="text-lg font-medium mt-4">Вхід</h3>
              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  name="login-username"
                  type="text"
                  placeholder="Ім'я користувача"
                  required
                  className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
                />
                <input
                  name="login-password"
                  type="password"
                  placeholder="Пароль"
                  required
                  className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors"
                  disabled={isLoading}
                >
                  {isLoading ? "Завантаження..." : "Увійти"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium mt-4">Додати пост</h3>
              <form onSubmit={handleAddPost} className="space-y-4">
                <input
                  name="title"
                  type="text"
                  placeholder="Назва фільму/серіалу"
                  required
                  className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  name="content"
                  placeholder="Контент"
                  required
                  className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
                />
                <select
                  name="category"
                  className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="review">Рецензія</option>
                  <option value="news">Новина</option>
                  <option value="awards">Обговорення</option>
                </select>
                <input
                  name="tags"
                  type="text"
                  placeholder="Теги (через кому)"
                  className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
                />
                <input
                  name="media-url"
                  type="text"
                  placeholder="URL медіа (опціонально)"
                  className="w-full p-2 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white p-2 rounded transition-colors"
                  disabled={isLoading}
                >
                  {isLoading ? "Завантаження..." : "Додати"}
                </button>
              </form>
            </>
          )}
        </aside>

        {/* Основний контент */}
        <main className="w-full md:w-3/4">
          {currentPage === "home" && renderHomePage()}
          {currentPage === "post" && selectedPost && (
            <PostDetailPage
              selectedPost={selectedPost}
              token={token}
              userId={userId}
              lastRequestTime={lastRequestTime}
              setShowDeleteModal={setShowDeleteModal}
              setDeleteId={setDeleteId}
              onBack={() => {
                setCurrentPage("home");
                setSelectedPost(null);
              }}
              setIsLoading={setIsLoading}
            />
          )}
        </main>
      </div>

      {/* Модальне вікно для підтвердження видалення */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg animate-fade-in">
            <h3 className="text-lg font-bold mb-4">
              Ви впевнені, що хочете видалити{" "}
              {showDeleteModal === "post" ? "пост" : "коментар"}?
            </h3>
            <div className="flex gap-4">
              <button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
                disabled={isLoading}
              >
                {isLoading ? "Видалення..." : "Так, видалити"}
              </button>
              <button
                onClick={() => setShowDeleteModal(null)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
