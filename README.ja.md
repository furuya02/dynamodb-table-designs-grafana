# dynamodb-table-designs-grafana

[English](README.md) | 日本語

よくある 4 つの DynamoDB テーブル設計を、テーブルを変えずに Grafana で表示するサンプルです。データの読み出しには OSS の [Ductus（dynamodb-timeseries-api）](https://github.com/furuya02/dynamodb-timeseries-api) を使います。Ductus のコードは変えず、設定ファイル（ductus/datasets.yaml）とダッシュボードだけを用意しています。

| | テーブル設計 | テーブル | キーの例 |
|---|---|---|---|
| 1 | 日付で分けたキー | dynamodb-table-designs-grafana-daily-key | pk = meter-01#2026-11-16（JST の日付）、ts = epoch 秒 |
| 2 | シングルテーブル設計 | dynamodb-table-designs-grafana-single-table | pk = room#a、sk = TEMP#2026-11-16T00:00:00Z / HUM#... / PROFILE |
| 3 | タイムゾーンなしの ISO 8601 | dynamodb-table-designs-grafana-local-iso | deviceId = line-1、ts = 2026-11-16T09:00:00（JST） |
| 4 | GSI | dynamodb-table-designs-grafana-events | eventId = pump-1-...、GSI byDevice（deviceId + ts = epoch ミリ秒） |

## 構成

```
.
├── cdk/                 4 つのテーブルを作る CDK
├── scripts/seed.ts      サンプルデータ（5 分おき、3 日分）の投入
├── ductus/datasets.yaml Ductus の設定（4 つのテーブル設計 + timezone の比較用）
└── grafana/             ダッシュボード（4 つのテーブル設計 / timezone の比較）
```

## 必要なもの

- Node.js 22 以上、pnpm 10 以上
- Docker（ローカルの Grafana）
- AWS CLI v2、CDK の bootstrap が済んだ AWS アカウント

## 構築手順

### 1. テーブルの作成とデータの投入

```bash
git clone https://github.com/furuya02/dynamodb-table-designs-grafana.git
cd dynamodb-table-designs-grafana
pnpm install
export AWS_REGION=ap-northeast-1
pnpm cdk-deploy
pnpm seed
```

### 2. Ductus のデプロイ

Ductus を別のディレクトリに取得し、このリポジトリの ductus/datasets.yaml を指定してデプロイします。

```bash
cd ..
git clone https://github.com/furuya02/dynamodb-timeseries-api.git
cd dynamodb-timeseries-api
pnpm install
pnpm cdk-deploy -c config=$(pwd)/../dynamodb-table-designs-grafana/ductus/datasets.yaml -c auth=apiKey
```

### 3. Grafana の起動

デプロイの出力に表示される GetApiKeyCommand で API キーを取得し、ダッシュボードをコピーしてから起動します。

```bash
export TSAPI_API_KEY=$(aws apigateway get-api-key --api-key <API キー ID> --include-value --query value --output text)
cp ../dynamodb-table-designs-grafana/grafana/*.json grafana/dashboards/
pnpm grafana-config
pnpm grafana-up
```

## 動作確認

1. http://localhost:3000/ を開き、「Dashboards」→「dynamodb-timeseries-api」を選びます
2. 「Four table designs (Ductus)」で、4 つのテーブル設計のグラフが表示されることを確かめます
3. 「Timezone setting comparison (Ductus)」で、timezone を指定しない場合との違いを確かめます
   - 日付で分けたキー（power_utc）: 表示期間の終わりが JST の 0〜9 時のとき、その日の 0 時以降が欠けます
   - タイムゾーンなしの ISO 8601（line_count_utc）: グラフが 9 時間後ろにずれます

自分のテーブル用の設定の下書きは、Ductus のディレクトリで `pnpm init-dataset --table <テーブル名>` で作れます（GSI は `--index <GSI 名>` を付けます）。

## 片付け

```bash
# Ductus のディレクトリで
pnpm grafana-down
pnpm cdk-destroy
# このリポジトリで
cd ../dynamodb-table-designs-grafana
pnpm cdk-destroy
```

## 費用

DynamoDB（オンデマンド）、Lambda、API Gateway のリクエスト課金のみです。サンプルデータ約 8,600 件の投入と数百回の問い合わせで、ap-northeast-1 では $0.1 未満の見込みです。確認が終わったら削除してください。

## ライセンス

MIT
