// Configuration loading utility for the frontend

import { FrontendConfig, ServerConfig } from './types';

let configCache: FrontendConfig | null = null;

/**
 * Load the frontend configuration from /config.json
 * @returns Promise<FrontendConfig>
 */
export async function loadConfig(): Promise<FrontendConfig> {
  if (configCache) {
    return configCache;
  }

  try {
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`);
    }
    
    configCache = await response.json();
    return configCache as FrontendConfig;
  } catch (error) {
    console.error('Failed to load config, using defaults:', error);
    
    // Fallback to hardcoded config if loading fails
    const fallbackConfig: FrontendConfig = {
      servers: [
        {
          id: 'default',
          name: 'Log Server',
          url: window.location.origin,
          username: 'admin'
        }
      ]
    };
    
    configCache = fallbackConfig;
    return fallbackConfig;
  }
}

/**
 * Get the default server from the configuration
 * @returns Promise<ServerConfig>
 */
export async function getDefaultServer(): Promise<ServerConfig> {
  const config = await loadConfig();
  
  if (!config.servers || config.servers.length === 0) {
    throw new Error('No servers configured');
  }
  
  return config.servers[0];
}

/**
 * Get all servers from the configuration
 * @returns Promise<ServerConfig[]>
 */
export async function getAllServers(): Promise<ServerConfig[]> {
  const config = await loadConfig();
  return config.servers || [];
}