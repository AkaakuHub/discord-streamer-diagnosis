import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { connect } from './cdp.mjs';
import { inspectRenderer } from './renderer.mjs';
import { inspectProcesses, assertPortAvailable, restartDiscord } from './windows.mjs';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--check')) throw new Error('使用方法: node scripts/diagnose.mjs [--check]');
if (process.platform !== 'win32' || Number(process.versions.node.split('.')[0]) !== 24) {
  throw new Error('WindowsとNode.js 24 LTSが必要です。');
}
const processes = inspectProcesses();
assertPortAvailable();
if (args.includes('--check')) {
  console.log(JSON.stringify({ node: process.version, ...processes }, null, 2));
} else await diagnose();

async function diagnose() {
  let client;
  let original;
  let settingChanged = false;
  let interrupted = false;
  process.once('SIGINT', () => {
    interrupted = true;
    client?.close();
  });
  async function evaluate(action, seconds = 0, enabled = false) {
    if (interrupted) throw new Error('診断を中断しました。');
    return client.evaluate(`(${inspectRenderer.toString()})(${JSON.stringify(action)},${seconds},${enabled})`);
  }
  async function waitForDetection() {
    for (let attempt = 0; attempt < 30; attempt++) {
      const state = await evaluate('status');
      if (state.detectionReady) return state;
      await delay(1000);
    }
    throw new Error('Discordのプロセス検出が開始されませんでした。');
  }
  console.log('Discordを再起動して配信モードの状態を確認します。');
  try {
    restartDiscord(processes.executable, true);
    client = await connect();
    original = await waitForDetection();
    const logic = await evaluate('logic');
    const baseline = await evaluate('watch', 15);
    console.log('配信モードをオフにして再起動します。');
    settingChanged = true;
    await evaluate('set', 0, false);
    await delay(2000);
    client.close();
    restartDiscord(processes.executable, true);
    client = await connect();
    await waitForDetection();
    const afterRestart = await evaluate('watch', 20);
    const allSamples = [...baseline.samples, ...afterRestart.samples];
    const noTools = allSamples.every(sample => sample.detectionReady && sample.tools.length === 0);
    const stayedOff = afterRestart.samples.every(sample => sample.enabled === false);
    const stayedOn = baseline.samples.every(sample => sample.enabled === true);
    const automaticStayedOn = allSamples.every(sample => sample.autoToggle === true);
    const detectedTools = [...new Set(allSamples.flatMap(sample => sample.tools.map(tool => tool.name)))];
    const automaticallyEnabled = afterRestart.samples.every(sample => sample.enabled && sample.autoToggle && sample.tools.length > 0);
    let result = original.enabled && stayedOn && automaticStayedOn && noTools && stayedOff && logic.initialCountIsZero && logic.persisted
      ? '配信ツール0件でも保存されたオンが起動時に残る動作を再現しました。最初にオンになったきっかけは特定できません。'
      : '今回と同じ条件は再現されませんでした。記録から確認できる範囲を判断してください。';
    if (detectedTools.length > 0) {
      result = `Discordが${detectedTools.join('、')}を配信ツールとして検出しています。${automaticallyEnabled
        ? '配信モードをオフにして再起動すると、自動切り替えでオンに戻りました。'
        : '再起動後の自動有効化は確認できませんでした。'}`;
    }
    const directory = new URL('../reports/', import.meta.url);
    await mkdir(directory, { recursive: true });
    const file = new URL(`${new Date().toISOString().replaceAll(':', '-')}.json`, directory);
    await writeFile(file, JSON.stringify({ result, original, processes, logic, baseline, afterRestart }, null, 2));
    console.log(result);
    console.log(`記録: ${file.pathname}`);
  } finally {
    try {
      if (settingChanged && original) {
        client?.close();
        client = await connect();
        await client.evaluate(`(${inspectRenderer.toString()})('set',0,${original.enabled})`);
        await delay(2000);
      }
    } finally {
      client?.close();
      restartDiscord(processes.executable, false);
      console.log('Discordを通常起動に戻しました。');
    }
  }
}
