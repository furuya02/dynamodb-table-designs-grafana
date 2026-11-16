// ---------------------------------------------------------------
// 4 つのテーブルにサンプルデータ（5 分おき、既定 3 日分）を書き込む
//   pnpm seed [--days 3]
// 時刻は「今」を 5 分に切り捨てた時点まで。何度実行しても同じ時刻の値は同じになる
// ---------------------------------------------------------------
import { parseArgs } from 'node:util';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const { values: args } = parseArgs({ options: { days: { type: 'string', default: '3' } } });
const PREFIX = 'dynamodb-table-designs-grafana';
const STEP = 5 * 60_000;
const JST = 9 * 3_600_000;
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? 'ap-northeast-1' }));

// JST の壁時計（タイムゾーンなし）"2026-11-16T09:00:00"
const jstIso = (t: number) => new Date(t + JST).toISOString().slice(0, 19);
const jstHour = (t: number) => new Date(t + JST).getUTCHours() + new Date(t).getUTCMinutes() / 60;
const isWeekday = (t: number) => ![0, 6].includes(new Date(t + JST).getUTCDay());
// 時刻と系列から決まる疑似乱数（-1〜1）。何度実行しても同じ値になる
const noise = (t: number, salt: number) => {
  const x = Math.sin(t / STEP * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};
const round1 = (v: number) => Math.round(v * 10) / 10;

const end = Math.floor(Date.now() / STEP) * STEP;
const start = end - Number(args.days) * 86_400_000;
const items: Record<string, Record<string, unknown>[]> = { 'daily-key': [], 'single-table': [], 'local-iso': [], events: [] };

for (let t = start; t <= end; t += STEP) {
  const h = jstHour(t);
  const office = isWeekday(t) && h >= 9 && h < 18;
  const wave = Math.sin(((h - 8) / 24) * 2 * Math.PI); // 14 時頃に最大

  // (1) 日付で分けたキー（JST の日付で分ける）: 電力計
  for (const [i, id] of ['meter-01', 'meter-02'].entries()) {
    const watt = (i === 0 ? 300 : 150) + (office ? (i === 0 ? 900 : 500) : 0) + noise(t, i) * 30;
    items['daily-key'].push({ pk: `${id}#${jstIso(t).slice(0, 10)}`, ts: t / 1000, watt: Math.round(watt) });
  }
  // (2) シングルテーブル設計: 部屋の温度と湿度を同じパーティションに、種類のプレフィックスで分けて置く
  for (const [i, room] of ['a', 'b'].entries()) {
    const iso = new Date(t).toISOString().replace('.000Z', 'Z');
    items['single-table'].push({ pk: `room#${room}`, sk: `TEMP#${iso}`, value: round1(21 + i + wave * 3 + noise(t, 10 + i) * 0.3) });
    items['single-table'].push({ pk: `room#${room}`, sk: `HUM#${iso}`, value: round1(55 - i * 5 - wave * 8 + noise(t, 20 + i)) });
  }
  // (3) タイムゾーンなしの ISO 8601（JST の時刻で保存）: 生産ラインの 5 分ごとの生産数
  for (const [i, line] of ['line-1', 'line-2'].entries()) {
    const running = isWeekday(t) && h >= 8 && h < 17;
    items['local-iso'].push({ deviceId: line, ts: jstIso(t), count: running ? Math.round((i === 0 ? 40 : 30) + noise(t, 30 + i) * 5) : 0 });
  }
  // (4) GSI: イベント ID をキーにしたテーブル。deviceId + ts の GSI で時系列として読む
  for (const [i, pump] of ['pump-1', 'pump-2'].entries()) {
    const vibration = 2 + i + (h >= 6 && h < 22 ? 1.5 : 0) + noise(t, 40 + i) * 0.4;
    items.events.push({ eventId: `${pump}-${t}`, deviceId: pump, ts: t, vibration: round1(vibration) });
  }
}
// シングルテーブル設計には、時系列でないアイテム（部屋の情報）も置く
items['single-table'].push({ pk: 'room#a', sk: 'PROFILE', name: 'Meeting room A' }, { pk: 'room#b', sk: 'PROFILE', name: 'Meeting room B' });

async function writeAll(table: string, rows: Record<string, unknown>[]) {
  const batches = [];
  for (let i = 0; i < rows.length; i += 25) batches.push(rows.slice(i, i + 25));
  for (let i = 0; i < batches.length; i += 10) {
    await Promise.all(
      batches.slice(i, i + 10).map(async (b) => {
        let req = { [table]: b.map((Item) => ({ PutRequest: { Item } })) };
        while (Object.keys(req).length > 0) req = ((await doc.send(new BatchWriteCommand({ RequestItems: req }))).UnprocessedItems ?? {}) as typeof req;
      }),
    );
  }
}

const t0 = Date.now();
for (const [name, rows] of Object.entries(items)) {
  await writeAll(`${PREFIX}-${name}`, rows);
  console.log(`${PREFIX}-${name}: ${rows.length} items`);
}
console.log(`${jstIso(start)} - ${jstIso(end)} (JST), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
