# HeartLink API（前端 + 后端）

本文件基于后端代码 `C:\Users\22421\Desktop\HeartLink-backend` 和前端使用 `C:\Users\22421\Desktop\本地`，整理当前接口。

## 基础
- Base URL：与前端部署同源
- 鉴权请求头：`token: <user_id>`（MVP）
- Content-Type：`application/json`

## 认证
### POST /api/auth
Body：
```
{
  "action": "register" | "login",
  "username": "string",
  "password": "string",
  "coupleCode": "string",   // 仅注册
  "role": "boy" | "girl"   // 仅注册
}
```
成功（register）：
```
{ "ok": true, "message": "..." }
```
成功（login）：
```
{
  "ok": true,
  "token": "<user_id>",
  "user": { "id": "...", "username": "...", "role": "boy|girl", "coupleCode": "..." }
}
```
错误：400/401/500

## AI 聊天
### POST /api/chat
Headers：`token`（或放在 body 里）
Body：
```
{
  "token": "<user_id>",
  "mood": { "weather": "sun|rain|thunderstorm", "energy": 0-100, "note": "string" },
  "messages": [ { "role": "user|ai", "content": "string" } ],
  "userText": "string",
  "likes": ["string", "string"]
}
```
成功：
```
{ "reply": "string" }
```
错误：401/429/500

## 情侣聊天（HTTP）
### POST /api/coupleChat?action=send
Headers：`token`
Body：
```
{
  "client_msg_id": "string",
  "content": "string",
  "device_id": "string"
}
```
成功：
```
{
  "client_msg_id": "...",
  "message_id": "...",
  "seq": 1,
  "server_ts": 1700000000000,
  "status": "sent|deduped"
}
```

### GET /api/coupleChat?action=sync&last_seq=0&limit=50
Headers：`token`
成功：
```
{
  "messages": [
    {
      "message_id": "...",
      "client_msg_id": "...",
      "seq": 1,
      "server_ts": 1700000000000,
      "sender_id": "...",
      "receiver_id": "...",
      "content": "...",
      "device_id": "..."
    }
  ],
  "server_seq": 123,
  "my_read_seq": 120,
  "partner_read_seq": 118
}
```

### POST /api/coupleChat?action=read
Headers：`token`
Body：
```
{ "max_read_seq": 123 }
```
成功：
```
{ "ok": true, "my_read_seq": 123, "partner_read_seq": 118 }
```

## 情侣聊天（WebSocket，仅开发）
WS URL：`ws://<host>:3001`
消息：
- `auth`：`{ "type": "auth", "token": "<user_id>" }`
- `send`：`{ "type": "send", "client_msg_id": "...", "content": "...", "device_id": "..." }`
- `sync`：`{ "type": "sync", "last_seq": 0, "limit": 50 }`
- `read`：`{ "type": "read", "max_read_seq": 123 }`
服务端推送：
- `auth_ok`, `ack`, `message`, `read`, `sync`, `error`

## 同步（情侣共享数据）
### GET /api/sync?kind=mood|events|settings
Headers：`token`
成功：
```
{ "data": <any>, "updatedAt": 1700000000000 }
```

### POST /api/sync
Headers：`token`
Body：
```
{ "kind": "mood|events|settings", "data": <any> }
```
成功：
```
{ "ok": true, "updatedAt": 1700000000000, "relationRaw": { ... } }
```

## 轻戳
### GET /api/poke
Headers：`token`
成功：
```
{ "events": [ { "id": "...", "from": "...", "to": "...", "t": 1700000000000 } ], "ack": 0, "serverNow": 1700000000000 }
```

### POST /api/poke
Headers：`token`
Body（发送 poke）：
```
{ "type": "poke" }
```
Body（ack）：
```
{ "type": "ack", "t": 1700000000000 }
```

## 怪物功能备注（待新增）
- 需要指标：每日消息数 / 字符数，最后互动时间，打卡连续天数，心情快照。
- 建议新接口：
  - GET /api/monster/status
  - POST /api/monster/act
  - GET /api/monster/metrics
