/** Host half of the Aurora Glass bundle.
 *
 * v1.1.0 — rewritten around the REAL runtime contract discovered via the
 * 1.0.11–1.0.13 probes:
 *   - `globalThis.harness` does NOT exist in this runner; every pre-1.1.0
 *     host half hit the "harness unavailable" guard and silently exited.
 *   - The inherited context allows SERVICE access via ctx.get(name) WITHOUT
 *     inject (property access on the facade still throws without inject).
 *   - ctx.inject(['webServer'], cb) exists; the callback runs asynchronously.
 *
 * Readout channels in this build:
 *   A) GET /aurora-report  -> latest client payload replayed as JSON
 *   B) GET /aurora-debug   -> host truth: web boot graph entry for this
 *      package, clientPath, artifactBaseline, rebuilt rev, service probing
 *   C) best-effort local file append via the `fs` service (async contract)
 *
 * Everything is defensive: no channel failure may break activation.
 */

const REPORT_PATHS = [
  "C:/Users/jia'meng'yang/.dsh/aurora-report.json",
  'D:/DSH-workplace/dsh-aurora-glass/aurora-report.json',
  'D:/DSH-work/dsh-work-1/aurora-report.json',
];

export function apply(context) {
  const out = {
    pkg: 'dsh-aurora-glass',
    v: '1.1.0',
    applyAt: new Date().toISOString(),
    events: [],
  };
  const note = (e) => out.events.push(e);
  const say = (msg) => {
    note(msg);
    try {
      console.error('[aurora] ' + msg);
    } catch {
      /* no console */
    }
  };

  say('apply start v1.1.0');

  // --- helpers -----------------------------------------------------------
  const safeType = (fn) => {
    try {
      return typeof fn();
    } catch {
      return 'ERR';
    }
  };

  const getService = (name) => {
    try {
      const s = context.get(name);
      return s;
    } catch (e) {
      note('service ' + name + ' err: ' + String((e && e.message) || e));
      return undefined;
    }
  };

  const box = { count: 0, last: null, lastAt: null };
  const persist = (payload) => {
    box.count += 1;
    box.last = payload;
    box.lastAt = new Date().toISOString();
    say('persist# ' + box.count + ' ' + String(box.lastAt));
  };

  // --- channel: client->host RPC, IF a handler registry exists ----------
  // The client half calls host.call('aurora.report', payload).  In this
  // runtime there is no globalThis.harness; probe the plausible services.
  const rpcCandidates = ['harness', 'runner', 'connection', 'rpc', 'host'];
  for (const name of rpcCandidates) {
    const s = getService(name);
    if (!s) continue;
    note('rpc candidate ' + name + ' type=' + typeof s);
    try {
      if (typeof s.handle === 'function') {
        s.handle('aurora.report', persist);
        note('rpc registered via ' + name);
        break;
      }
    } catch (e) {
      note('rpc ' + name + ' err: ' + String((e && e.message) || e));
    }
  }

  // --- channel C: webServer readout routes ------------------------------
  const ws = getService('webServer');
  if (ws && typeof ws.register === 'function') {
    const registerRoute = (path, handler) => {
      try {
        ws.register({ kind: 'exact', path, handler });
        say('route ' + path + ' registered');
        return true;
      } catch (e) {
        say('route ' + path + ' failed: ' + String((e && e.stack) || e));
        return false;
      }
    };
    registerRoute('/aurora-report', (req, res) => {
      try {
        const body = JSON.stringify({
          ok: true,
          pkg: 'dsh-aurora-glass',
          v: '1.1.0',
          at: new Date().toISOString(),
          count: box.count,
          lastAt: box.lastAt,
          last: box.last,
        });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(body);
      } catch (err) {
        res.statusCode = 500;
        res.end(String(err));
      }
    });
    registerRoute('/aurora-debug', (req, res) => {
      const d = {
        ok: true,
        pkg: 'dsh-aurora-glass',
        v: '1.1.0',
        at: new Date().toISOString(),
        events: out.events.slice(-60),
        origin: safeType(() => String(ws.getOrigin())),
        box: { count: box.count, lastAt: box.lastAt },
      };
      try {
        const cm = getService('clientModules');
        if (cm) {
          try {
            const g = cm.graph();
            const entry = (g && g.entries || []).filter((e) => e.id === 'dsh-aurora-glass')[0] || null;
            d.graph = {
              rev: g && g.rev,
              entry,
              batchUrls: (g && g.batches || []).map((b) => b.url),
            };
          } catch (e1) {
            d.graphErr = String((e1 && e1.message) || e1);
          }
          try {
            d.clientPath = cm.clientPath('dsh-aurora-glass');
          } catch (e2) {
            d.clientPathErr = String((e2 && e2.message) || e2);
          }
          try {
            d.artifactBaseline = cm.artifactBaseline('dsh-aurora-glass');
          } catch (e3) {
            d.baselineErr = String((e3 && e3.message) || e3);
          }
          try {
            d.rebuilt = cm.rebuilt('dsh-aurora-glass');
          } catch (e4) {
            d.rebuiltErr = String((e4 && e4.message) || e4);
          }
        } else {
          d.clientModules = 'absent';
        }
      } catch (outer) {
        d.err = String((outer && outer.message) || outer);
      }
      try {
        const body = JSON.stringify(d);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(body);
      } catch (err) {
        res.statusCode = 500;
        res.end(String(err));
      }
    });
  } else {
    say('webServer absent: ' + safeType(() => typeof context)); 
  }

  // --- channel B: best-effort disk via the fs service --------------------
  try {
    const fsService = getService('fs');
    if (fsService && typeof fsService.writeText === 'function') {
      note('fs service present');
      const dump = JSON.stringify(out);
      (async () => {
        try {
          for (const p of REPORT_PATHS) {
            try {
              const target = await fsService.resolve(p, { cwd: '/' });
              await fsService.writeText(target, dump + '\n', undefined, undefined, {});
            } catch (e) {
              note('disk ' + p + ' err: ' + String((e && e.message) || e));
            }
          }
        } catch (e) {
          note('disk async err: ' + String((e && e.message) || e));
        }
      })();
    } else {
      note('fs service absent');
    }
  } catch (e) {
    note('fs setup err: ' + String((e && e.message) || e));
  }

  persist({ event: 'host-apply', v: '1.1.0' });
  say('apply complete v1.1.0');
}