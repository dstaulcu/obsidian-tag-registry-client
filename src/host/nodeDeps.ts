import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as nodePath from 'path'
import { requestUrl } from 'obsidian'
import { PLUGIN_ID } from '../brand'
import { SourceConfig, SourceDeps } from '../core/sources'
import { sha256 } from '../core/stamp'

export function nodeDeps(cfg: SourceConfig): SourceDeps {
  const key = sha256(`${cfg.repoUrl}#${cfg.ref}`).slice(0, 12)
  return {
    platform: process.platform,
    // outside the vault, never synced
    cacheDir: nodePath.join(os.tmpdir(), `${PLUGIN_ID}-${key}`),
    httpGet: async (url, headers) => {
      const r = await requestUrl({ url, headers, throw: false })
      return { status: r.status, text: r.text }
    },
    run: (file, args, opts) =>
      new Promise((resolve, reject) => {
        // no shell; GIT_TERMINAL_PROMPT=0: fail instead of waiting on a credential prompt nobody can see
        execFile(
          file,
          args,
          { cwd: opts?.cwd, windowsHide: true, timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
          (err, stdout, stderr) => (err ? reject(Object.assign(err, { stderr })) : resolve({ stdout })),
        )
      }),
    readFile: (p) => fs.promises.readFile(p, 'utf8'),
    exists: (p) =>
      fs.promises.access(p).then(
        () => true,
        () => false,
      ),
  }
}
