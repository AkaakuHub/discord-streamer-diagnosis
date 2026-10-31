# Discord配信モードの診断

Windows上のDiscordで、配信モードが有効な理由を調べた際のプログラムをまとめています。PowerShellでプロセスを確認し、Node.jsからDiscordのローカル診断接続を使って、配信モードの設定と配信ツールの検出結果を取得します。追加パッケージは不要です。

## 実行

Windows、Node.js 24 LTS、起動中の通常版Discordが必要です。

```powershell
node scripts/diagnose.mjs --check
node scripts/diagnose.mjs
```

実行するとDiscordを複数回再起動するため、通話は切断されます。配信モードを一時的にオフにして検証するため、その間は画面共有を停止してください。終了時は元の配信モード設定に戻し、診断接続を閉じて通常起動します。

結果は`reports/`内のJSONに保存します。メッセージ、連絡先、認証情報、画面画像は取得しません。ログファイルやLocal Storage全体の読み取りも行いません。

## 診断の順序

1. Discordの実行ファイルと、既知の配信ツールのプロセスを確認します。
2. Discordを`127.0.0.1:9223`の診断接続付きで再起動します。
3. Discord内の`StreamerModeStore`と`RunningGameStore`から、有効状態、自動切り替え、検出した配信ツールだけを取得します。
4. 設定変更と配信ツールの検出件数変更を15秒間記録します。
5. 配信モードだけをオフにして再起動し、20秒間記録します。自動切り替えは変更しません。
6. 元の有効状態へ戻し、Discordを通常起動します。

`Ctrl+C`でも復元処理を試みます。プロセスの強制終了やPCの電源断では復元できません。その場合はDiscordを終了して通常起動し、配信モードの設定を確認してください。

公式の設定説明は[Discordの配信モードガイド](https://support.discord.com/hc/en-us/articles/218485407-Streamer-Mode-101)、内部処理の調査手順は[moonlightのDevTools解説](https://moonlight-mod.github.io/ext-dev/devtools/)を参照しました。今回、拡張機能は導入していません。
