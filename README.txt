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
