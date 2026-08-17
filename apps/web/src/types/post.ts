import { SocialAccount } from './social-account';

export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

export enum PublishAttemptStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface Media {
  id: string;
  postId: string;
  mediaType: MediaType;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublishAttempt {
  id: string;
  postId: string;
  status: PublishAttemptStatus;
  errorMessage?: string | null;
  apiErrorCode?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface Post {
  id: string;
  caption?: string | null;
  status: PostStatus;
  cover?: string | null;
  publishedUrl?: string | null;
  publishedAt?: string | null;
  socialAccountId: string;
  socialAccount?: SocialAccount;
  media?: Media[];
  publishAttempts?: PublishAttempt[];
  createdAt: string;
  updatedAt: string;
}

export interface PublishResponse {
  post: Post;
  attempt: PublishAttempt;
}

export interface PaginatedPostsResponse {
  data: Post[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
