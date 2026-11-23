# dynamodb-table-designs-grafana

English | [日本語](README.ja.md)

A sample that shows four common DynamoDB table designs in Grafana without changing the tables. The data is read through the OSS [Ductus (dynamodb-timeseries-api)](https://github.com/furuya02/dynamodb-timeseries-api). The Ductus code is not modified; this repository only provides a configuration file (ductus/datasets.yaml) and dashboards.

| | Table design | Table | Key example |
|---|---|---|---|
| 1 | Date-split partition key | dynamodb-table-designs-grafana-daily-key | pk = meter-01#2026-11-16 (JST date), ts = epoch seconds |
| 2 | Single-table design | dynamodb-table-designs-grafana-single-table | pk = room#a, sk = TEMP#2026-11-16T00:00:00Z / HUM#... / PROFILE |
| 3 | ISO 8601 without time zone | dynamodb-table-designs-grafana-local-iso | deviceId = line-1, ts = 2026-11-16T09:00:00 (JST) |
| 4 | GSI | dynamodb-table-designs-grafana-events | eventId = pump-1-..., GSI byDevice (deviceId + ts = epoch milliseconds) |

## Layout

```
.
├── cdk/                 CDK that creates the four tables
├── scripts/seed.ts      Loads sample data (every 5 minutes, 3 days)
├── ductus/datasets.yaml Ductus configuration (four table designs + timezone comparison)
└── grafana/             Dashboards (four table designs / timezone comparison)
```

## Requirements

- Node.js 22 or later, pnpm 10 or later
- Docker (local Grafana)
- AWS CLI v2 and an AWS account where CDK is bootstrapped

## Setup

### 1. Create the tables and load data

```bash
git clone https://github.com/furuya02/dynamodb-table-designs-grafana.git
cd dynamodb-table-designs-grafana
pnpm install
export AWS_REGION=ap-northeast-1
pnpm cdk-deploy
pnpm seed
```

### 2. Deploy Ductus

Clone Ductus into another directory and deploy it with ductus/datasets.yaml from this repository.

```bash
cd ..
git clone --branch v0.1.0 https://github.com/furuya02/dynamodb-timeseries-api.git
cd dynamodb-timeseries-api
pnpm install
pnpm cdk-deploy -c config=$(pwd)/../dynamodb-table-designs-grafana/ductus/datasets.yaml -c auth=apiKey
```

### 3. Start Grafana

Get the API key with the GetApiKeyCommand shown in the deploy outputs, copy the dashboards, and start Grafana.

```bash
export TSAPI_API_KEY=$(aws apigateway get-api-key --api-key <API key ID> --include-value --query value --output text)
cp ../dynamodb-table-designs-grafana/grafana/*.json grafana/dashboards/
pnpm grafana-config
pnpm grafana-up
```

## Verification

1. Open http://localhost:3000/ and select "Dashboards" → "dynamodb-timeseries-api"
2. In "Four table designs (Ductus)", check that the graphs of the four table designs are shown
3. In "Timezone setting comparison (Ductus)", check the difference from not setting timezone
   - Date-split partition key (power_utc): when the end of the time range is between 0:00 and 9:00 JST, data after 0:00 of that day is missing
   - ISO 8601 without time zone (line_count_utc): the graph shifts 9 hours later

To draft the configuration for your own table, run `pnpm init-dataset --table <table name>` in the Ductus directory (add `--index <GSI name>` for a GSI).

## Cleanup

```bash
# In the Ductus directory
pnpm grafana-down
pnpm cdk-destroy
# In this repository
cd ../dynamodb-table-designs-grafana
pnpm cdk-destroy
```

## Cost

Only request-based charges for DynamoDB (on-demand), Lambda, and API Gateway. Loading about 8,600 sample items and a few hundred queries is expected to cost less than $0.1 in ap-northeast-1. Delete the resources when you are done.

## License

MIT
