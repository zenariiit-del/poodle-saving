プー＄貯金 - 待ち時間なし無料版

構成:
静的Webアプリ → Supabase Auth / Database
Python、Flask、Render Web Service、Cloudflare Tunnelは不要です。

セットアップ:
1. SupabaseでFree projectを作成
2. SQL Editorで supabase_setup.sql を全て実行
3. Authentication → Users → Add user
   Email: poodle-savings@example.com
   Password: 自分で決めたアプリ用パスワード
4. Project Settings / API から Project URL と anon public key を確認
5. config.js の SUPABASE_URL / SUPABASE_ANON_KEY に貼り付け
6. このフォルダを GitHub Pages / Cloudflare Pages / Render Static Site のどれかで公開
7. iPhoneのSafariでURLを開く
8. 最初の1回だけパスワード入力
9. 共有 → ホーム画面に追加

セキュリティ:
・パスワードはHTML/JavaScriptには書きません。
・Supabase URLとanon keyはブラウザ利用向けの公開情報です。
・RLSでログイン済みユーザーだけが記録を読み書きできます。
・SafariのWebサイトデータを消した場合は再ログインが必要です。

おすすめ:
GitHub Pagesが最も簡単です。
静的サイトなので、久しぶりに開いてもFlaskのような起動待ちはありません。


v2 過去データ編集
-----------------
カレンダーの日付をタップすると、その日の合計金額を編集できます。
保存時は元の記録を削除せず、「差額」の adjustment レコードを追加します。

例:
現在 $110 → $80 に変更
=> -30 の adjustment を追加
=> 表示合計は $80

これにより、元の履歴を残したまま過去データを修正できます。


v3 レート取得・画像変更
----------------------
・為替レート取得を Frankfurter v2 API に変更
  https://api.frankfurter.dev/v2/rate/usd/jpy
・v2が取得できない場合はv1 APIへ自動フォールバック
・取得済みレートは端末にキャッシュ
・アプリ下部の「キャラクター画像」から好きな画像を選択可能
・選択画像はその端末のlocalStorageに保存
・「元に戻す」で標準プードルへ戻せます

注意:
ホーム画面のPWAアイコンはiOS側がmanifest/apple-touch-iconを参照するため、
アプリ内で選んだ画像には自動変更されません。
ホーム画面アイコンを変える場合は icons/apple-touch-icon.png 等を差し替えて再追加してください。


v4 ホーム画面アイコン変更
------------------------
1. アプリ下部の「キャラクター画像」で好きな画像を選択
2. 「ホーム画面用アイコンを作る」を押す
3. 180px / 192px / 512px の3つを保存
4. GitHubの icons フォルダで以下を上書き
   apple-touch-icon.png
   icon-192.png
   icon-512.png
5. GitHub Pagesの反映を待つ
6. iPhoneホーム画面から一度アプリを削除
7. Safariで公開URLを開き直し、「ホーム画面に追加」

iOSは既存ホーム画面アイコンを自動更新しないため、
画像を変更した場合はホーム画面への再追加が必要です。
