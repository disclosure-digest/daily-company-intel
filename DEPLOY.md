# iPhoneでPCなしに使う方法

このフォルダをGitHubリポジトリとして公開し、GitHub Pagesを有効にすると、PCサーバーなしでiPhoneから開けます。

## 仕組み

- iPhone: Safariの「ホーム画面に追加」でPWAとして開く
- GitHub Actions: 毎朝5時JSTにJPX銘柄一覧とTDnet決算開示を取得
- GitHub Pages: 静的HTML/JS/JSONを配信

## 初回設定

1. この `daily-company-intel` フォルダをGitHubリポジトリに置く
2. GitHubの `Settings > Pages` で `GitHub Actions` を選ぶ
3. `Actions` タブで `Daily company earnings update` を手動実行する
4. デプロイされたPages URLをiPhoneのSafariで開く
5. 共有ボタンから「ホーム画面に追加」

## 注意

カレンダーでまだ生成されていない過去日を選んだ場合、クラウド版ではその場取得はできません。毎朝の実行後、その日付のJSONが日付別アーカイブに残ります。

