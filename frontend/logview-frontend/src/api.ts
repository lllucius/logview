// API client for LogView backend

import axios, { AxiosInstance } from 'axios';
import { FileListResponse, FileContentResponse, UserInfoResponse, ServerConfig } from './types';

export class LogViewAPI {
  private client: AxiosInstance;
  private server: ServerConfig;

  constructor(server: ServerConfig) {
    this.server = server;
    this.client = axios.create({
      baseURL: server.url,
      headers: {
        'X-User': server.username,
      },
    });
  }

  async getFiles(directory: string = ''): Promise<FileListResponse> {
    const params = directory ? { directory } : {};
    const response = await this.client.get('/files', { params });
    return response.data;
  }

  async getFileContent(
    filePath: string,
    startLine: number = 1,
    pageSize: number = 1000
  ): Promise<FileContentResponse> {
    const response = await this.client.get(`/files/${filePath}`, {
      params: { start_line: startLine, page_size: pageSize },
    });
    return response.data;
  }

  async getUserInfo(): Promise<UserInfoResponse> {
    const response = await this.client.get('/user');
    return response.data;
  }

  async downloadFile(filePath: string): Promise<Blob> {
    const response = await this.client.get(`/files/${filePath}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async getTailStream(filePath: string): Promise<EventSource> {
    const url = `${this.server.url}/files/${filePath}/tail`;
    const eventSource = new EventSource(url, {
      // Note: EventSource doesn't support custom headers directly
      // The backend will need to handle authentication differently for SSE
    });
    return eventSource;
  }

  getServerInfo(): ServerConfig {
    return this.server;
  }
}

export class MultiServerAPI {
  private apis: Map<string, LogViewAPI> = new Map();

  addServer(server: ServerConfig): void {
    this.apis.set(server.id, new LogViewAPI(server));
  }

  removeServer(serverId: string): void {
    this.apis.delete(serverId);
  }

  getAPI(serverId: string): LogViewAPI | undefined {
    return this.apis.get(serverId);
  }

  getAllAPIs(): LogViewAPI[] {
    return Array.from(this.apis.values());
  }

  async getAllFiles(): Promise<Array<{ server: ServerConfig; files: FileListResponse }>> {
    const results = await Promise.allSettled(
      this.getAllAPIs().map(async (api) => {
        const files = await api.getFiles();
        return { server: api.getServerInfo(), files };
      })
    );

    return results
      .filter(
        (result): result is PromiseFulfilledResult<{ server: ServerConfig; files: FileListResponse }> =>
          result.status === 'fulfilled'
      )
      .map((result) => result.value);
  }
}