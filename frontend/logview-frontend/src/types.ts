// Types for the LogView application

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  modified_time: number;
  is_file: boolean;
  is_readable: boolean;
}

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  username: string;
}

export interface FullServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  base_path: string;
  auth_header: string;
  max_file_size: number;
  default_page_size: number;
  max_page_size: number;
  tail_buffer_size: number;
  tail_check_interval: number;
  groups: Array<{
    name: string;
    pattern: string;
    description: string;
    users: string[];
  }>;
}

export interface FrontendConfig {
  servers: FullServerConfig[];
  cors?: {
    allow_origins: string[];
    allow_credentials: boolean;
    allow_methods: string[];
    allow_headers: string[];
  };
}

export interface FileWithServer extends FileInfo {
  server: ServerConfig;
}

export interface FileListResponse {
  files: FileInfo[];
  directory: string;
  user_groups: string[];
}

export interface FileContentResponse {
  content: string[];
  file_path: string;
  start_line: number;
  page_size: number;
  total_lines: number;
  has_more: boolean;
}

export interface UserInfoResponse {
  username: string;
  groups: string[];
}

export type SortField = 'server' | 'name' | 'size' | 'modified_time';
export type SortDirection = 'asc' | 'desc';