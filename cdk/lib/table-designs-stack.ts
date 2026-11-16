// ---------------------------------------------------------------
// よくある 4 つのテーブル設計（Ductus で Grafana に表示する題材）
// 全てオンデマンド課金。cdk destroy でテーブルごと削除する
// ---------------------------------------------------------------
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';

const PREFIX = 'dynamodb-table-designs-grafana';
const S = dynamodb.AttributeType.STRING;
const N = dynamodb.AttributeType.NUMBER;

export class TableDesignsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const common = { billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, removalPolicy: cdk.RemovalPolicy.DESTROY };

    // (1) 日付で分けたキー: pk = meter-01#2026-11-16（JST の日付）、ts = epoch 秒
    new dynamodb.Table(this, 'DailyKey', {
      ...common,
      tableName: `${PREFIX}-daily-key`,
      partitionKey: { name: 'pk', type: S },
      sortKey: { name: 'ts', type: N },
    });

    // (2) シングルテーブル設計: pk = room#a、sk = TEMP#2026-11-16T00:00:00Z / HUM#... / PROFILE
    new dynamodb.Table(this, 'SingleTable', {
      ...common,
      tableName: `${PREFIX}-single-table`,
      partitionKey: { name: 'pk', type: S },
      sortKey: { name: 'sk', type: S },
    });

    // (3) タイムゾーンなしの ISO 8601: ts = 2026-11-16T09:00:00（JST の時刻）
    new dynamodb.Table(this, 'LocalIso', {
      ...common,
      tableName: `${PREFIX}-local-iso`,
      partitionKey: { name: 'deviceId', type: S },
      sortKey: { name: 'ts', type: S },
    });

    // (4) GSI: テーブルのキーはイベント ID。時系列としては GSI（deviceId + ts）で読む
    const events = new dynamodb.Table(this, 'Events', {
      ...common,
      tableName: `${PREFIX}-events`,
      partitionKey: { name: 'eventId', type: S },
    });
    events.addGlobalSecondaryIndex({
      indexName: 'byDevice',
      partitionKey: { name: 'deviceId', type: S },
      sortKey: { name: 'ts', type: N },
    });
  }
}
