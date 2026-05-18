import type { ComponentProps } from 'react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import './PostsPage.css'

const USER_STORAGE_KEY = 'mini-forum-user'
type FormSubmitHandler = NonNullable<ComponentProps<'form'>['onSubmit']>

interface StoredUser {
  id: string
  nickname: string
}

interface VoteSummary {
  upvotes: number
  downvotes: number
  score: number
  total: number
}

interface Post {
  _id: string
  authorNickname: string
  title: string
  body: string
  createdAt: string
  votes: VoteSummary
  currentUserVote: 1 | -1 | null
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const storedUser = localStorage.getItem(USER_STORAGE_KEY)
  const user = storedUser ? (JSON.parse(storedUser) as StoredUser) : null

  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { 'X-Nickname': user.nickname } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(error?.message ?? 'Yêu cầu thất bại')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function getStoredUser() {
  const rawUser = localStorage.getItem(USER_STORAGE_KEY)
  return rawUser ? (JSON.parse(rawUser) as StoredUser) : null
}

export function PostsPage() {
  const queryClient = useQueryClient()
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(() => getStoredUser())
  const [nickname, setNickname] = useState('')
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')

  const postsQuery = useQuery({
    queryKey: ['posts', currentUser?.id ?? null],
    queryFn: () => {
      const userQuery = currentUser ? `?userId=${currentUser.id}` : ''
      return request<Post[]>(`/api/posts${userQuery}`)
    },
  })

  const createUserMutation = useMutation({
    mutationFn: (nextNickname: string) =>
      request<StoredUser>('/api/users', {
        method: 'POST',
        body: JSON.stringify({ nickname: nextNickname }),
      }),
    onSuccess: (user) => {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
      setCurrentUser(user)
      setNickname('')
    },
  })

  const createPostMutation = useMutation({
    mutationFn: (post: { title: string; body: string }) => {
      if (!currentUser) {
        throw new Error('Hãy tạo biệt danh trước khi đăng bài')
      }

      return request<{ id: string }>('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          authorId: currentUser.id,
          title: post.title,
          body: post.body,
        }),
      })
    },
    onSuccess: () => {
      setPostTitle('')
      setPostBody('')
      setIsCreatePostOpen(false)
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })

  const votePostMutation = useMutation({
    mutationFn: (vote: { postId: string; value: 1 | -1 }) => {
      if (!currentUser) {
        throw new Error('Hãy tạo biệt danh trước khi vote')
      }

      return request<void>(`/api/posts/${vote.postId}/votes`, {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser.id,
          value: vote.value,
        }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })

  const sortedPosts = useMemo(() => postsQuery.data ?? [], [postsQuery.data])
  const trimmedNickname = nickname.trim()
  const trimmedPostTitle = postTitle.trim()
  const trimmedPostBody = postBody.trim()
  const isNicknameModalOpen = !currentUser

  const handleCreateNickname: FormSubmitHandler = (event) => {
    event.preventDefault()

    if (!trimmedNickname) {
      return
    }

    createUserMutation.mutate(trimmedNickname)
  }

  const handleCreatePost: FormSubmitHandler = (event) => {
    event.preventDefault()

    if (!trimmedPostTitle || !trimmedPostBody) {
      return
    }

    createPostMutation.mutate({
      title: trimmedPostTitle,
      body: trimmedPostBody,
    })
  }

  return (
    <main className="forum-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Diễn đàn MLN</p>
          <h1>Bài đăng</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="primary-action"
            disabled={!currentUser}
            onClick={() => setIsCreatePostOpen(true)}
            type="button"
          >
            Tạo bài đăng
          </button>
          <div className="user-chip" aria-label="Current nickname">
            <span>{currentUser?.nickname ?? 'Guest'}</span>
          </div>
        </div>
      </header>

      <section className="post-feed" aria-label="Post list">
        {postsQuery.isLoading && <p className="status-text">Đang tải các bài đăng...</p>}

        {postsQuery.isError && (
          <div className="notice" role="alert">
            {(postsQuery.error as Error).message}
          </div>
        )}

        {!postsQuery.isLoading && !postsQuery.isError && sortedPosts.length === 0 && (
          <div className="empty-state">
            <h2>Hiện tại chưa có bài đăng</h2>
            <p>Bài đăng mới sẽ được xuất hiện tại đây.</p>
          </div>
        )}

        {sortedPosts.map((post) => (
          <article className="post-row" key={post._id}>
            <div className="vote-stack" aria-label={`Score ${post.votes.score}`}>
              <button
                aria-label={`Upvote ${post.title}`}
                className={post.currentUserVote === 1 ? 'is-selected' : undefined}
                disabled={!currentUser || votePostMutation.isPending}
                onClick={(e) => { e.stopPropagation(); votePostMutation.mutate({ postId: post._id, value: 1 }) }}
                aria-pressed={post.currentUserVote === 1}
                type="button"
              >
                +
              </button>
              <strong>{post.votes.score}</strong>
              <span>{post.votes.total === 1 ? 'vote' : 'votes'}</span>
              <button
                aria-label={`Downvote ${post.title}`}
                className={post.currentUserVote === -1 ? 'is-selected' : undefined}
                disabled={!currentUser || votePostMutation.isPending}
                onClick={(e) => { e.stopPropagation(); votePostMutation.mutate({ postId: post._id, value: -1 }) }}
                aria-pressed={post.currentUserVote === -1}
                type="button"
              >
                -
              </button>
            </div>
            <Link to={`/posts/${post._id}`} className="post-content-link">
              <div className="post-content">
                <div className="post-meta">
                  <span>Đăng bởi {post.authorNickname}</span>
                  <span>{new Date(post.createdAt).toLocaleString()}</span>
                  <span>{post.votes.upvotes} lên</span>
                  <span>{post.votes.downvotes} xuống</span>
                </div>
                <h2>{post.title}</h2>
                <p>{post.body}</p>
              </div>
            </Link>
          </article>
        ))}
      </section>

      {isNicknameModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="nickname-modal" role="dialog" aria-modal="true" aria-labelledby="nickname-title">
            <h2 id="nickname-title">Tạo biệt danh mới</h2>
            <p>Biệt danh này sẽ được lưu lại bởi trình duyệt để bạn có thể thực hiện các hành động trên hệ thống.</p>

            <form onSubmit={handleCreateNickname}>
              <label htmlFor="nickname">Biệt danh</label>
              <input
                autoFocus
                id="nickname"
                maxLength={32}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="e.g. Nguyễn Văn A"
                value={nickname}
              />

              {createUserMutation.isError && (
                <p className="form-error">{(createUserMutation.error as Error).message}</p>
              )}

              <button disabled={!trimmedNickname || createUserMutation.isPending} type="submit">
                {createUserMutation.isPending ? 'Saving...' : 'Tiếp tục'}
              </button>
            </form>
          </section>
        </div>
      )}

      {isCreatePostOpen && currentUser && (
        <div className="modal-backdrop" role="presentation">
          <section className="nickname-modal post-modal" role="dialog" aria-modal="true" aria-labelledby="post-title">
            <div className="modal-heading">
              <div>
                <h2 id="post-title">Tạo bài đăng</h2>
                <p>Đăng với biệt danh {currentUser.nickname}.</p>
              </div>
              <button
                aria-label="Close create post modal"
                className="close-button"
                onClick={() => setIsCreatePostOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <form onSubmit={handleCreatePost}>
              <label htmlFor="post-title-input">Tiêu đề</label>
              <input
                autoFocus
                id="post-title-input"
                maxLength={120}
                onChange={(event) => setPostTitle(event.target.value)}
                placeholder="Nhập tiêu đề"
                value={postTitle}
              />

              <label htmlFor="post-body-input">Nội dung</label>
              <textarea
                id="post-body-input"
                onChange={(event) => setPostBody(event.target.value)}
                placeholder="Bạn muốn chia sẻ điều gì?"
                rows={6}
                value={postBody}
              />

              {createPostMutation.isError && (
                <p className="form-error">{(createPostMutation.error as Error).message}</p>
              )}

              <button
                disabled={!trimmedPostTitle || !trimmedPostBody || createPostMutation.isPending}
                type="submit"
              >
                {createPostMutation.isPending ? 'Đang lưu...' : 'Đăng bài'}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
