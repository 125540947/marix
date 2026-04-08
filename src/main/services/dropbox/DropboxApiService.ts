/**
 * Dropbox API Service
 * Handles file operations with Dropbox cloud storage
 */

const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_URL = 'https://content.dropboxapi.com/2';

interface DropboxFileMetadata {
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  size: number;
  modified: string;
}

interface DropboxBackupMetadata {
  name: string;
  path: string;
  size: number;
  modified: string;
}

class DropboxApiService {
  private accessToken: string = '';

  /**
   * Set access token
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Upload backup file to Dropbox
   */
  static async uploadBackup(accessToken: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${DROPBOX_CONTENT_URL}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: '/marix_backup.marix',
            mode: 'overwrite',
            autorename: false,
            mute: false,
          }),
        },
        body: content,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[Dropbox] Upload failed:', error);
        return { success: false, error: `Upload failed: ${response.statusText}` };
      }

      console.log('[Dropbox] Backup uploaded successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[Dropbox] Upload error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Download backup file from Dropbox
   */
  static async downloadBackup(accessToken: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const response = await fetch(`${DROPBOX_CONTENT_URL}/files/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({
            path: '/marix_backup.marix',
          }),
        },
      });

      if (!response.ok) {
        if (response.status === 409) {
          return { success: false, error: 'No backup found' };
        }
        const error = await response.text();
        console.error('[Dropbox] Download failed:', error);
        return { success: false, error: `Download failed: ${response.statusText}` };
      }

      const content = await response.text();
      return { success: true, content };
    } catch (error: any) {
      console.error('[Dropbox] Download error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if backup exists
   */
  static async backupExists(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/get_metadata`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: '/marix_backup.marix',
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('[Dropbox] Backup exists check failed:', error);
      return false;
    }
  }

  /**
   * Get backup metadata
   */
  static async getBackupMetadata(accessToken: string): Promise<DropboxBackupMetadata | null> {
    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/get_metadata`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: '/marix_backup.marix',
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data: DropboxFileMetadata = await response.json();
      return {
        name: data.name,
        path: data.path_display,
        size: data.size,
        modified: data.modified,
      };
    } catch (error) {
      console.error('[Dropbox] Get metadata failed:', error);
      return null;
    }
  }

  /**
   * Delete backup file
   */
  static async deleteBackup(accessToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/delete_v2`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: '/marix_backup.marix',
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Delete failed: ${response.statusText}` };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all files in app folder
   */
  static async listFiles(accessToken: string): Promise<DropboxBackupMetadata[]> {
    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/list_folder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: '',
          recursive: false,
          include_media_info: false,
        }),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.entries
        .filter((entry: any) => entry['.tag'] === 'file')
        .map((file: DropboxFileMetadata) => ({
          name: file.name,
          path: file.path_display,
          size: file.size,
          modified: file.modified,
        }));
    } catch (error) {
      console.error('[Dropbox] List files failed:', error);
      return [];
    }
  }
}

export default DropboxApiService;
