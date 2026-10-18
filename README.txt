poo$ Saving v5 - Apple style

変更点
- タイトルを poo$ Saving に変更
- Apple風の白 / 淡いピンク / ガラスデザインへ全面変更
- キャラクター画像変更機能を削除
- ホーム画面アイコン生成機能を削除
- これまでの累計USDを表示
- 円への交換機能を追加
- 交換済みUSDを累計から差し引き、残りUSDを表示
- 交換した日のUSD/JPYレートを保存
- 日本で使える円の累計を表示
- 円交換履歴を表示
- 過去日の金額編集機能は継続

既存Supabase利用者が必ず行うこと
1. Supabase → SQL Editor → New query
2. supabase_v5_migration.sql の中身を全部貼る
3. Run

GitHub更新
- config.js は上書きしないでください。
- それ以外はv5ファイルで上書きしてOKです。
- GitHub Pages URLは変わりません。

円への交換
「円に交換」→ USD金額を入力 → その時点の為替レートでJPYへ換算。
交換時の rate / USD / JPY をSupabase exchangesテーブルへ保存します。

表示
- これまでの累計 = fartデータの全合計
- 交換済み = exchangesのUSD合計
- 残っている貯金 = これまでの累計 - 交換済み
- 日本で使えるお金 = exchangesのJPY合計

注意
この機能は貯金を円へ交換した記録を管理するものです。実際の銀行・両替サービスで通貨交換を実行する機能ではありません。
