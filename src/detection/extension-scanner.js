const fs = require('fs');
const path = require('path');
const os = require('os');

// Known AI/cheating extension IDs and name patterns
const SUSPICIOUS_EXTENSIONS = [
  { id: 'fcoeoabgfenejglbffodgkkbkcdhcgfn', name: 'Claude Browser Extension', severity: 'critical' },
  { namePattern: /claude/i, name: 'Claude Extension', severity: 'critical' },
  { namePattern: /cluely/i, name: 'Cluely Extension', severity: 'critical' },
  { namePattern: /chatgpt|openai/i, name: 'ChatGPT Extension', severity: 'high' },
  { namePattern: /perplexity/i, name: 'Perplexity Extension', severity: 'high' },
  { namePattern: /copilot/i, name: 'Copilot Extension', severity: 'high' },
  { namePattern: /grammarly/i, name: 'Grammarly', severity: 'medium' },
  { namePattern: /quillbot/i, name: 'QuillBot', severity: 'high' },
];

function getExtensionDirs() {
  const home = os.homedir();
  const platform = os.platform();

  if (platform === 'darwin') {
    return [
      path.join(home, 'Library/Application Support/Google/Chrome/Default/Extensions'),
      path.join(home, 'Library/Application Support/Google/Chrome/Profile 1/Extensions'),
      path.join(home, 'Library/Application Support/BraveSoftware/Brave-Browser/Default/Extensions'),
      path.join(home, 'Library/Application Support/Microsoft Edge/Default/Extensions'),
      path.join(home, 'Library/Application Support/Arc/User Data/Default/Extensions'),
    ];
  }

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return [
      path.join(localAppData, 'Google/Chrome/User Data/Default/Extensions'),
      path.join(localAppData, 'BraveSoftware/Brave-Browser/User Data/Default/Extensions'),
      path.join(localAppData, 'Microsoft/Edge/User Data/Default/Extensions'),
    ];
  }

  return [];
}

class ExtensionScanner {
  constructor(onSignal) {
    this.onSignal = onSignal;
  }

  runOnce() {
    const extensionDirs = getExtensionDirs();

    for (const extDir of extensionDirs) {
      try {
        if (!fs.existsSync(extDir)) continue;

        const extensionIds = fs.readdirSync(extDir);

        for (const extId of extensionIds) {
          // Check by known extension ID
          const knownById = SUSPICIOUS_EXTENSIONS.find((e) => e.id === extId);
          if (knownById) {
            this.onSignal({
              type: 'extension-installed',
              severity: knownById.severity,
              metadata: {
                extensionName: knownById.name,
                extensionId: extId,
                browserPath: extDir,
              },
            });
            continue;
          }

          // Try to read manifest.json to check extension name
          const manifestPath = this.findManifest(path.join(extDir, extId));
          if (manifestPath) {
            try {
              const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
              const extName = manifest.name || '';

              const knownByName = SUSPICIOUS_EXTENSIONS.find(
                (e) => e.namePattern && e.namePattern.test(extName)
              );

              if (knownByName) {
                this.onSignal({
                  type: 'extension-installed',
                  severity: knownByName.severity,
                  metadata: {
                    extensionName: `${knownByName.name} (${extName})`,
                    extensionId: extId,
                    browserPath: extDir,
                  },
                });
              }
            } catch {
              // Can't parse manifest — skip
            }
          }
        }
      } catch {
        // Directory not accessible — skip
      }
    }
  }

  findManifest(extensionDir) {
    try {
      // Extensions are stored as extId/version/manifest.json
      const versions = fs.readdirSync(extensionDir);
      if (versions.length > 0) {
        const latest = versions.sort().pop();
        const manifestPath = path.join(extensionDir, latest, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          return manifestPath;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
}

module.exports = { ExtensionScanner };
