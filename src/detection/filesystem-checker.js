const fs = require('fs');
const path = require('path');
const os = require('os');

// Known installation paths for AI/cheating tools
function getCheckPaths() {
  const home = os.homedir();
  const platform = os.platform();

  if (platform === 'darwin') {
    return [
      // AI Desktop Apps
      {
        path: '/Applications/Claude.app',
        name: 'Claude Desktop',
        severity: 'critical',
        category: 'ai-tool',
      },
      {
        path: '/Applications/ChatGPT.app',
        name: 'ChatGPT Desktop',
        severity: 'critical',
        category: 'ai-tool',
      },
      {
        path: '/Applications/Cluely.app',
        name: 'Cluely',
        severity: 'critical',
        category: 'ai-tool',
      },
      {
        path: '/Applications/Cursor.app',
        name: 'Cursor IDE',
        severity: 'high',
        category: 'ai-tool',
      },
      {
        path: '/Applications/Windsurf.app',
        name: 'Windsurf IDE',
        severity: 'high',
        category: 'ai-tool',
      },
      {
        path: '/Applications/Perplexity.app',
        name: 'Perplexity',
        severity: 'critical',
        category: 'ai-tool',
      },

      // Remote access
      {
        path: '/Applications/TeamViewer.app',
        name: 'TeamViewer',
        severity: 'critical',
        category: 'remote-access',
      },
      {
        path: '/Applications/AnyDesk.app',
        name: 'AnyDesk',
        severity: 'critical',
        category: 'remote-access',
      },

      // AI browser variants
      {
        path: '/Applications/Arc.app',
        name: 'Arc Browser',
        severity: 'medium',
        category: 'ai-browser',
      },
      {
        path: '/Applications/Opera Neon.app',
        name: 'Opera Neon',
        severity: 'high',
        category: 'ai-browser',
      },
      {
        path: '/Applications/Dia.app',
        name: 'Dia Browser',
        severity: 'high',
        category: 'ai-browser',
      },

      // Config directories (indicates past or current use)
      {
        path: path.join(home, '.config/claude'),
        name: 'Claude Config',
        severity: 'medium',
        category: 'ai-tool-config',
      },
      {
        path: path.join(home, 'Library/Application Support/Claude'),
        name: 'Claude App Data',
        severity: 'medium',
        category: 'ai-tool-config',
      },
      {
        path: path.join(home, 'Library/Application Support/Cluely'),
        name: 'Cluely App Data',
        severity: 'high',
        category: 'ai-tool-config',
      },
    ];
  }

  if (platform === 'win32') {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    return [
      {
        path: path.join(localAppData, 'Programs\\claude'),
        name: 'Claude Desktop',
        severity: 'critical',
        category: 'ai-tool',
      },
      {
        path: path.join(localAppData, 'Programs\\chatgpt'),
        name: 'ChatGPT Desktop',
        severity: 'critical',
        category: 'ai-tool',
      },
      {
        path: path.join(localAppData, 'Programs\\Cluely'),
        name: 'Cluely',
        severity: 'critical',
        category: 'ai-tool',
      },
      {
        path: path.join(localAppData, 'Programs\\cursor'),
        name: 'Cursor IDE',
        severity: 'high',
        category: 'ai-tool',
      },
      {
        path: path.join(programFiles, 'TeamViewer'),
        name: 'TeamViewer',
        severity: 'critical',
        category: 'remote-access',
      },
      {
        path: path.join(programFiles, 'AnyDesk'),
        name: 'AnyDesk',
        severity: 'critical',
        category: 'remote-access',
      },
    ];
  }

  return [];
}

class FilesystemChecker {
  constructor(onSignal) {
    this.onSignal = onSignal;
  }

  runOnce() {
    const checks = getCheckPaths();

    for (const check of checks) {
      try {
        if (fs.existsSync(check.path)) {
          this.onSignal({
            type: 'app-installed',
            severity: check.severity,
            metadata: {
              appName: check.name,
              category: check.category,
              path: check.path,
            },
          });
        }
      } catch {
        // Permission denied or other fs error — skip
      }
    }
  }
}

module.exports = { FilesystemChecker };
