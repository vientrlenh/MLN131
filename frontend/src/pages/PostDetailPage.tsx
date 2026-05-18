import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import './PostDetailPage.css'

const USER_STORAGE_KEY = 'mini-forum-user'

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

interface PostDetail {
  _id: string
  authorNickname: string
  title: string
  body: string
  createdAt: string
  votes: VoteSummary
  currentUserVote: 1 | -1 | null
}

interface Comment {
  _id: string
  postId: string
  authorId: string
  authorNickname: string
  body: string
  createdAt: string
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

export function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>()
  const queryClient = useQueryClient()
  const [currentUser] = useState<StoredUser | null>(() => getStoredUser())
  const [commentText, setCommentText] = useState('')
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const postQuery = useQuery({
    queryKey: ['post', postId],
    queryFn: () => {
      const userQuery = currentUser ? `?userId=${currentUser.id}` : ''
      return request<PostDetail>(`/api/posts/${postId}${userQuery}`)
    },
    enabled: !!postId,
  })

  const commentsQuery = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => request<Comment[]>(`/api/posts/${postId}/comments`),
    enabled: !!postId,
  })

  const createCommentMutation = useMutation({
    mutationFn: (body: string) => {
      if (!currentUser) {
        throw new Error('Hãy tạo biệt danh trước khi bình luận')
      }
      return request<{ id: string }>(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          authorId: currentUser.id,
          body,
        }),
      })
    },
    onSuccess: () => {
      setCommentText('')
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
    },
  })

  const comments = commentsQuery.data ?? []
  const trimmedComment = commentText.trim()

  useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments.length])

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmedComment) return
    createCommentMutation.mutate(trimmedComment)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (trimmedComment && currentUser) {
        createCommentMutation.mutate(trimmedComment)
      }
    }
  }

  if (postQuery.isLoading) {
    return (
      <main className="detail-shell">
        <div className="detail-loading">Đang tải bài đăng...</div>
      </main>
    )
  }

  if (postQuery.isError || !postQuery.data) {
    return (
      <main className="detail-shell">
        <div className="detail-error">
          {(postQuery.error as Error)?.message ?? 'Không tìm thấy bài đăng'}
        </div>
      </main>
    )
  }

  const post = postQuery.data

  return (
    <main className="detail-shell">
      <header className="detail-topbar">
        <Link to="/" className="back-button">
          Quay lại
        </Link>
        <p className="detail-topbar-title">{post.title}</p>
      </header>

      <div className="detail-body">
        <div className="post-detail-content">
          <div className="post-detail-header">
            <h1>{post.title}</h1>
            <div className="post-detail-meta">
              <span>Đăng bởi {post.authorNickname}</span>
              <span>{new Date(post.createdAt).toLocaleString()}</span>
              <span>{post.votes.upvotes} lên</span>
              <span>{post.votes.downvotes} xuống</span>
              <span>Score: {post.votes.score}</span>
            </div>
          </div>
          <p className="post-detail-text">{post.body}</p>
        </div>

        <section className="comments-section">
          <h2 className="comments-header">
            Thảo luận ({comments.length})
          </h2>

          <div className="comments-list">
            {commentsQuery.isLoading && (
              <p className="comments-empty">Đang tải bình luận...</p>
            )}

            {!commentsQuery.isLoading && comments.length === 0 && (
              <p className="comments-empty">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
            )}

            {comments.map((comment) => (
              <article className="comment-card" key={comment._id}>
                <div className="comment-meta">
                  <span className="comment-author">{comment.authorNickname}</span>
                  <span>{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <p className="comment-body">{comment.body}</p>
              </article>
            ))}
            <div ref={commentsEndRef} />
          </div>
        </section>
      </div>

      <form className="comment-input-bar" onSubmit={handleSubmitComment}>
        <div className="comment-input-inner">
          <textarea
            placeholder={currentUser ? 'Nhập bình luận... (Enter để gửi, Shift+Enter để xuống dòng)' : 'Tạo biệt danh trước khi bình luận'}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!currentUser || createCommentMutation.isPending}
            rows={1}
          />
          <button
            type="submit"
            className="comment-send-btn"
            disabled={!trimmedComment || !currentUser || createCommentMutation.isPending}
          >
            {createCommentMutation.isPending ? '...' : 'Gửi'}
          </button>
        </div>
        {createCommentMutation.isError && (
          <p className="comment-form-error">
            {(createCommentMutation.error as Error).message}
          </p>
        )}
      </form>
    </main>
  )
}
