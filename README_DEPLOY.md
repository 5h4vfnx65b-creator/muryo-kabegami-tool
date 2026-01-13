# 無料壁紙ツール（生成版 / Vercel）

## 何ができる？
- 無料（ローカル）: 端を整えるだけ（速い/コスト0）
- 生成（サーバー）: 写真の周りの景色を作って拡張（/api/extend）

画像編集は OpenAI Image API の「Create image edit（/v1/images/edits）」を使っています。
公式: https://platform.openai.com/docs/api-reference/images

## デプロイ手順（おすすめ）
1) このフォルダを GitHub にアップ  
2) Vercel で Import  
3) Environment Variables に `OPENAI_API_KEY` を追加  
4) Deploy

## ローカルで起動（任意）
```bash
npm i
npx vercel dev
```

## 広告について
フロントの「広告を見て生成」は **テスト用の仮**です。
本番では広告SDKに置き換えて、広告が出た時だけ /api/extend を呼ぶようにしてください。


## 赤字ゼロ運用
生成（/api/extend）は **広告視聴OKのときだけ**実行する仕様になっています。広告が出ない/キャンセルの場合は生成しません。
