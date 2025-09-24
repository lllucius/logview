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