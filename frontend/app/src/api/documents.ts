import { authenticationHeaders, BASE_URL, buildUrlParams, handleResponse, type Page, type PageParams, zodPage } from '@/lib/request';
import { zodJsonDate } from '@/lib/zod';
import { z, type ZodType } from 'zod';

export interface Document {
  id: number,
  name: string,
  created_at: Date;
  updated_at: Date
  last_modified_at: Date,
  hash: string
  content: string
  meta: object,
  mime_type: string,
  source_uri: string,
  index_status: string,
  index_result?: unknown
  data_source_id: number
}

const documentSchema = z.object({
  id: z.number(),
  name: z.string(),
  created_at: zodJsonDate(),
  updated_at: zodJsonDate(),
  last_modified_at: zodJsonDate(),
  hash: z.string(),
  content: z.string(),
  meta: z.object({}).passthrough(),
  mime_type: z.string(),
  source_uri: z.string(),
  index_status: z.string(),
  index_result: z.unknown(),
  data_source_id: z.number(),
}) satisfies ZodType<Document, any, any>;

export async function listDocuments ({ page = 1, size = 10, query, data_source_id }: PageParams & { data_source_id?: number, query?: string } = {}): Promise<Page<Document>> {
  return await fetch(BASE_URL + '/api/v1/admin/documents' + '?' + buildUrlParams({ page, size, data_source_id, query }), {
    headers: await authenticationHeaders(),
  })
    .then(handleResponse(zodPage(documentSchema)));
}
