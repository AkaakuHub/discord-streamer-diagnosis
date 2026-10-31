export async function inspectRenderer(action, seconds = 0, enabled = false) {
  if (typeof webpackChunkdiscord_app === 'undefined' && action === 'status') {
    return { detectionReady: false };
  }
  const runtimes = [];
  webpackChunkdiscord_app.push([[Symbol('streamer-diagnosis')], {}, runtime => runtimes.push(runtime)]);
  webpackChunkdiscord_app.pop();
  const runtime = runtimes.find(item => item.m?.[351906] && item.m?.[952818]);
  if (!runtime && action === 'status') return { detectionReady: false };
  if (!runtime) throw new Error('未対応のDiscord内部構造です。');
  const streamer = runtime(351906).A;
  const games = runtime(952818).Ay;
  const dispatcher = runtime(73153).h;
  function snapshot() {
    const debug = games.getDetectionDebug();
    return {
      time: new Date().toISOString(), enabled: streamer.enabled, autoToggle: streamer.autoToggle,
      detectionReady: debug != null,
      tools: debug?.entries.filter(entry => entry.outcome?.streamerTool).map(entry => ({
        name: entry.outcome.appName, executable: entry.game.exeName, pid: entry.game.pid,
      })) ?? [],
    };
  }
  if (action === 'status') return snapshot();
  if (action === 'set') {
    dispatcher.dispatch({ type: 'STREAMER_MODE_UPDATE', key: 'enabled', value: enabled });
    return snapshot();
  }
  if (action === 'logic') {
    const code = runtime.m[952818].toString();
    const position = code.indexOf('RUNNING_STREAMER_TOOLS_CHANGE');
    const surrounding = code.slice(position - 100, position + 100);
    const countName = surrounding.match(/!==([\w$]+)&&/)?.[1];
    return {
      initialCountIsZero: countName != null && code.includes(`${countName}=0`),
      countChangeHandler: surrounding,
      persisted: runtime.m[351906].toString().includes('PersistedStore'),
    };
  }
  if (action !== 'watch') throw new Error('未知の診断操作です。');
  const events = [];
  function onTools(event) {
    events.push({ time: new Date().toISOString(), type: event.type, count: event.count });
  }
  function onSetting(event) {
    if (event.key === 'enabled' || event.key === 'autoToggle') {
      events.push({ time: new Date().toISOString(), type: event.type, key: event.key, value: event.value });
    }
  }
  dispatcher.subscribe('RUNNING_STREAMER_TOOLS_CHANGE', onTools);
  dispatcher.subscribe('STREAMER_MODE_UPDATE', onSetting);
  const samples = [snapshot()];
  const timer = setInterval(() => samples.push(snapshot()), 1000);
  try {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    samples.push(snapshot());
    return { samples, events };
  } finally {
    clearInterval(timer);
    dispatcher.unsubscribe('RUNNING_STREAMER_TOOLS_CHANGE', onTools);
    dispatcher.unsubscribe('STREAMER_MODE_UPDATE', onSetting);
  }
}
