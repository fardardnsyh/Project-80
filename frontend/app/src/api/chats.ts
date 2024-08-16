import type { ChatEngineOptions } from '@/api/chat-engines';
import { type KnowledgeGraph, knowledgeGraphSchema } from '@/api/graph';
import { bufferedReadableStreamTransformer } from '@/lib/buffered-readable-stream';
import { authenticationHeaders, BASE_URL, buildUrlParams, handleErrors, handleResponse, type Page, type PageParams, zodPage } from '@/lib/request';
import { zodJsonDate } from '@/lib/zod';
import { parseStreamPart } from 'ai';
import { z, type ZodType } from 'zod';

const mockChat = !!process.env.NEXT_PUBLIC_MOCKING_CHAT;

export interface Chat {
  title: string;
  engine_id: number;
  engine_options: ChatEngineOptions;
  deleted_at: Date | null;
  user_id: string | null;
  browser_id: string | null;
  updated_at: Date;
  created_at: Date;
  id: string;
}

export interface ChatDetail {
  chat: Chat;
  messages: ChatMessage[];
}

export const enum ChatMessageRole {
  assistant = 'assistant',
  user = 'user'
}

export interface ChatMessage {
  id: number;
  role: ChatMessageRole;
  error: string | null;
  trace_url: string | null;
  finished_at: Date | null;
  user_id: string | null;
  created_at: Date;
  updated_at: Date;
  ordinal: number;
  content: string;
  sources: ChatMessageSource[];
  chat_id: string;
}

export interface ChatMessageSource {
  id: number;
  name: string;
  source_uri: string;
}

export const chatSchema = z.object({
  title: z.string(),
  engine_id: z.number(),
  engine_options: z.string().transform(value => JSON.parse(value) as ChatEngineOptions),
  deleted_at: zodJsonDate().nullable(),
  user_id: z.string().nullable(),
  browser_id: z.string().nullable(),
  updated_at: zodJsonDate(),
  created_at: zodJsonDate(),
  id: z.string(),
}) satisfies ZodType<Chat, any, any>;

const chatMessageSourceSchema = z.object({
  id: z.number(),
  name: z.string(),
  source_uri: z.string(),
});

export const chatMessageSchema = z.object({
  id: z.number(),
  role: z.enum([ChatMessageRole.user, ChatMessageRole.assistant]),
  error: z.string().nullable(),
  trace_url: z.string().nullable(),
  finished_at: zodJsonDate().nullable(),
  user_id: z.string().nullable(),
  created_at: zodJsonDate(),
  updated_at: zodJsonDate(),
  ordinal: z.number(),
  content: z.string(),
  sources: chatMessageSourceSchema.array(),
  chat_id: z.string(),
}) satisfies ZodType<ChatMessage, any, any>;

const chatDetailSchema = z.object({
  chat: chatSchema,
  messages: chatMessageSchema.array(),
});

export interface FeedbackParams {
  feedback_type: 'like' | 'dislike';
  comment: string;
}

export interface PostChatParams {
  chat_id?: string;
  chat_engine?: string;
  content: string;

  headers?: HeadersInit;
  signal?: AbortSignal;
}

export async function listChats ({ page = 1, size = 10 }: PageParams = {}): Promise<Page<Chat>> {
  return await fetch(BASE_URL + '/api/v1/chats' + '?' + buildUrlParams({ page, size }), {
    headers: await authenticationHeaders(),
  })
    .then(handleResponse(zodPage(chatSchema)));
}

export async function getChat (id: string): Promise<ChatDetail> {
  return await fetch(BASE_URL + `/api/v1/chats/${id}`, {
    headers: await authenticationHeaders(),
  })
    .then(handleResponse(chatDetailSchema));
}

export async function deleteChat (id: string): Promise<void> {
  await fetch(BASE_URL + `/api/v1/chats/${id}`, {
    method: 'delete',
    headers: await authenticationHeaders(),
  }).then(handleErrors);
}

export async function postFeedback (chatMessageId: number, feedback: FeedbackParams) {
  return await fetch(BASE_URL + `/api/v1/chat-messages/${chatMessageId}/feedback`, {
    method: 'post',
    headers: {
      ...await authenticationHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(feedback),
  }).then(handleErrors);
}

export async function getChatMessageSubgraph (chatMessageId: number): Promise<KnowledgeGraph> {
  return await fetch(BASE_URL + `/api/v1/chat-messages/${chatMessageId}/subgraph`, {
    headers: await authenticationHeaders(),
  })
    .then(handleResponse(knowledgeGraphSchema));
}

export async function* chat ({ chat_id, chat_engine, content, headers: headersInit, signal }: PostChatParams, onResponse?: (response: Response) => void) {
  if (mockChat) {
    const res = await fetch('/chats.mock.txt');
    const text = await res.text();
    for (let line of text.split('\n')) {
      if (line.startsWith('0:')) {
        await new Promise(resolve => setTimeout(resolve, 0));
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (line) {
        yield parseStreamPart(line + '\n');
      }
    }
    return;
  }

  const headers = new Headers(headersInit);
  headers.set('Content-Type', 'application/json');

  for (let [key, value] of Object.entries(await authenticationHeaders())) {
    headers.set(key, value);
  }

  const response = await fetch(BASE_URL + `/api/v1/chats`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chat_id,
      chat_engine,
      stream: true,
      messages: [{
        'role': 'user',
        content,
      }],
    }),
    signal,
  }).then(handleErrors);

  onResponse?.(response);

  if (!response.body) {
    throw new Error(`${response.status} ${response.statusText} Empty response body`);
  }

  const reader = response.body.pipeThrough(bufferedReadableStreamTransformer()).getReader();

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    if (!!chunk.value.trim()) {
      yield parseStreamPart(chunk.value);
    }
  }
}
