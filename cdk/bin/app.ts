#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TableDesignsStack } from '../lib/table-designs-stack';

const app = new cdk.App();
new TableDesignsStack(app, 'DynamodbTableDesignsGrafanaStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1' },
});
