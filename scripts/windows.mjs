import { execFileSync } from 'node:child_process';

function powershell(source) {
  return execFileSync('powershell', ['-NoProfile', '-Command', source], {
    encoding: 'utf8', windowsHide: true, timeout: 20000,
  }).trim();
}

export function inspectProcesses() {
  return JSON.parse(powershell(`
    $discord = Get-Process -Name Discord -ErrorAction Stop |
      Where-Object { $_.Path } | Select-Object -First 1;
    $tools = @(Get-Process -Name obs,obs32,obs64,'XSplit.Gamecaster','XSplit.Core',Gamecaster,bebo,'Streamlabs OBS','Streamlabs Desktop',TwitchStudio -ErrorAction SilentlyContinue |
      Select-Object ProcessName,Id);
    [pscustomobject]@{ executable=$discord.Path; tools=$tools } | ConvertTo-Json -Depth 3 -Compress
  `));
}

export function assertPortAvailable() {
  const occupied = powershell(`
    [bool](Get-NetTCPConnection -State Listen -LocalPort 9223 -ErrorAction SilentlyContinue)
  `);
  if (occupied !== 'False') throw new Error('診断用ポート9223は使用中です。');
}

export function restartDiscord(executable, diagnostic) {
  const literal = `'${executable.replaceAll("'", "''")}'`;
  powershell(`
    $processes = @(Get-Process -Name Discord -ErrorAction SilentlyContinue);
    $processes | Stop-Process -Force;
    foreach ($discordProcess in $processes) {
      Wait-Process -Id $discordProcess.Id -Timeout 10 -ErrorAction SilentlyContinue;
    }
    Start-Process -FilePath ${literal} ${diagnostic ? '-ArgumentList "--remote-debugging-port=9223","--remote-debugging-address=127.0.0.1"' : ''} -WindowStyle Hidden
  `);
}
