import { app, shell, net } from 'electron';

const REPO_OWNER = 'Morbis190';
const REPO_NAME = 'hr-database';
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const RELEASES_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  isOutdated: boolean;
  releaseUrl: string;
  releaseName: string;
  publishedAt: string;
}

function compareVersions(current: string, latest: string): boolean {
  const c = current.replace(/^v/, '').split('.').map(Number);
  const l = latest.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export function checkForUpdates(): Promise<UpdateInfo> {
  return new Promise((resolve, reject) => {
    const currentVersion = app.getVersion();

    const request = net.request({
      method: 'GET',
      url: GITHUB_API_URL,
    });

    request.setHeader('Accept', 'application/vnd.github.v3+json');
    request.setHeader('User-Agent', `HR-Database/${currentVersion}`);

    let body = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        body += chunk.toString();
      });

      response.on('end', () => {
        try {
          if (response.statusCode !== 200) {
            reject(new Error(`GitHub API returned ${response.statusCode}`));
            return;
          }

          const release = JSON.parse(body);
          const latestVersion = release.tag_name || '';
          const isOutdated = compareVersions(currentVersion, latestVersion);

          resolve({
            currentVersion,
            latestVersion: latestVersion.replace(/^v/, ''),
            isOutdated,
            releaseUrl: release.html_url || RELEASES_URL,
            releaseName: release.name || latestVersion,
            publishedAt: release.published_at || '',
          });
        } catch (err: any) {
          reject(new Error(`Failed to parse release info: ${err.message}`));
        }
      });
    });

    request.on('error', (err) => {
      reject(new Error(`Network error checking for updates: ${err.message}`));
    });

    request.end();
  });
}

export function openReleasePage(url?: string) {
  shell.openExternal(url || RELEASES_URL);
}
