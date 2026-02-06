<template>
  <div id="legacy-root">



<div id = "chatApp"  >
    <div id = "message" class = "message"></div>

</div>



<div id="auth-overlay" class="hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:var(--bg-color); z-index:9999; display:flex; align-items:center; justify-content:center; padding: 18px;">
    <div class="card" style="width:90%; max-width:340px; text-align:center;">
        <h1 style="margin-bottom:16px;">💘 Co-Space</h1>

        <div id="auth-form" style="display:flex; flex-direction:column; gap:12px;">
            <input id="auth-user" class="input" placeholder="用户名 (Username)" />
            <input id="auth-pass" class="input" type="password" placeholder="密码 (Password)" />

            <div id="register-fields" class="hidden" style="display:flex; flex-direction:column; gap:12px;">
                <input id="auth-code" class="input" placeholder="配对码 (如 LOVE-99)" />
                <div class="seg" id="auth-role-seg" style="justify-content:center;">
                    <button type="button" data-role="boy" class="active">我是男生</button>
                    <button type="button" data-role="girl">我是女生</button>
                </div>
                <div class="muted" style="font-size:12px; line-height: 1.35;">
                    *已有对象的输入对象给的码<br>*没有对象的随便输一个创建新空间
                </div>
            </div>

            <button id="btn-submit" class="btn btn-primary" type="button">登录</button>
            <div style="margin-top:10px;">
                <span id="toggle-auth" style="color:var(--primary-blue); cursor:pointer; font-size:14px;">没有账号？去注册</span>
            </div>
        </div>
    </div>
</div>
<div id="rope" role="button" tabindex="0" aria-label="拉绳开启聊天">拉绳</div>
<div id="backdrop" class="backdrop "></div>
<div id="sheet" class="sheet ">
    <div id = "aiHeader" class ="sheetHeader" >用户和ai的聊天界面</div>

    <div id = "deepseekGround" class ="sheetBody">
        <!-- ============ PAGE: CHAT ============ -->
            <div id="page-chat" class="page hidden">
                <div class="top-section-wrapper">
                    <section class="mood-section">
                        <div class="mood-emoji" id="js-mood-emoji">⛈️</div>
                        <div class="mood-text">
                            <h3 id="js-mood-title">有点小雷暴</h3>
                            <p id="js-mood-subtitle">能量值 15% · 建议给她点个热奶茶</p>
                        </div>
                    </section>

                    <section class="countdown-bar">
                        <div class="progress-info">
                            <span class="days-label">距离下次见面</span>
                            <span class="days-left" id="js-countdown">12 天 04 小时</span>
                        </div>
                        <div style="font-size: 22px;">🚄</div>
                    </section>
                </div>

                <section class="chat-section">
                    <div class="chat-header">
                        <div class="chat-header-left">
                            <span class="status-dot"></span>
                            <span>恋爱管家 (DeepSeek)</span>
                        </div>
                        <button class="btn btn-ghost btn-small" id="chat-clear" type="button">清空</button>
                    </div>

                    <!-- 快捷回复 -->
                    <div class="chips-row" id="js-chips">
                        <button class="chip" data-text="快！我也看到了，她是不是又被工作气到了🥺">快！我也看到了</button>
                        <button class="chip" data-text="我现在不讲道理，只想抱抱你🫶">只抱抱</button>
                        <button class="chip" data-text="我给你点杯热的，好不好？">点杯热的</button>
                        <button class="chip" data-text="要不要我现在打给你？">打给你</button>
                    </div>

                    <div class="chat-messages" id="js-chat-messages"></div>

                    <div class="input-area-wrapper">
                        <div class="input-box">
                            <input id="js-input" type="text" placeholder="问问我怎么哄她..." />
                            <button id="js-send" class="send-btn">➤</button>
                        </div>
                    </div>
                </section>
            </div>

    
    </div>
</div>

<div class="app-container">

    <header class="header">
        <div class="date-title">
            <h1 id="js-date-title">1月 27日</h1>
            <div style="display:flex; align-items:center; gap:8px;">
                <span id="js-days-together">💕 ...</span>
                <div id="js-cloud-status" style="width:10px; height:10px; border-radius:50%; background:#ccc; transition:0.3s;" title="未连接"></div>
            </div>
        </div>
        <button id="poke-btn" class="poke-btn" type="button" aria-label="拍一拍">💗</button>
        <div class="avatar" id="js-avatar" title="头像 / 背景设置">👧🏻</div>
    </header>

    
    <!-- ============ PAGE: HOME ============ -->
    <div id="page-home" class="page">
        <div class="card home-hero" style="margin-top: 8px;">
            <div class="home-badge">🧸 Co‑Space · 把喜欢写进日常</div>
            <h2 id="home-greeting">嘿，今天也要好好相爱</h2>
            <div class="muted" id="home-sub">给彼此留一盏小灯：一句话、一个计划、一个抱抱。</div>

            <div class="home-stats">
                <div class="home-stat">
                    <div class="num" id="home-days">—</div>
                    <div class="label">已在一起</div>
                </div>
                <div class="home-stat">
                    <div class="num" id="home-countdown">—</div>
                    <div class="label">距离下次见面</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">✨ 快速开始</div>
            <div class="home-grid">
                <button class="home-action chat" id="home-go-chat" type="button">
                    <div class="left">
                        <div class="title">恋爱管家</div>
                        <div class="sub">一句话哄到位</div>
                    </div>
                    <div class="icon">💬</div>
                </button>

                <button class="home-action calendar" id="home-go-calendar" type="button">
                    <div class="left">
                        <div class="title">日历计划</div>
                        <div class="sub">把见面写进日程</div>
                    </div>
                    <div class="icon">📅</div>
                </button>

                <button class="home-action diary" id="home-go-diary" type="button">
                    <div class="left">
                        <div class="title">共享时光轴</div>
                        <div class="sub">记录小确幸</div>
                    </div>
                    <div class="icon">📝</div>
                </button>

                <button class="home-action settings" id="home-go-settings" type="button">
                    <div class="left">
                        <div class="title">偏好设置</div>
                        <div class="sub">让 AI 更懂她</div>
                    </div>
                    <div class="icon">⚙️</div>
                </button>
            </div>
        </div>

        <div class="card">
            <div class="card-title">🌤️ 今日小气象</div>
            <div class="home-mini">
                <div class="home-mini-emoji" id="home-mood-emoji">⛈️</div>
                <div>
                    <h4 id="home-mood-title">有点小雷暴</h4>
                    <div class="muted" id="home-mood-note">能量 15% · 我在这里</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">📌 今天的小计划</div>
            <div class="home-preview" id="home-events-preview">
                <div class="muted">还没有计划，去日历里写一个小目标吧～</div>
            </div>
        </div>

        <div class="card" style="margin-bottom: 120px;">
            <div class="card-title">🪄 最近的瞬间</div>
            <div class="home-preview" id="home-timeline-preview">
                <div class="muted">还没有记录，去时光轴写下第一个闪光瞬间吧～</div>
            </div>
        </div>
    </div>


    <!-- ============ PAGE: CALENDAR ============ -->
    <div id="page-calendar" class="page hidden">
        <div class="card">
            <div class="card-title">📅 本地日历</div>
            <div class="calendar-head">
                <button class="icon-btn" id="cal-prev" type="button">‹</button>
                <div class="month-title" id="cal-month-title">2026年 1月</div>
                <button class="icon-btn" id="cal-next" type="button">›</button>
            </div>
            <div class="weekdays">
                <div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div><div>日</div>
            </div>
            <div class="days-grid" id="cal-grid"></div>
            <div class="spacer"></div>
            <div class="muted">点日期查看/新增当天的小计划（只保存在本机，不会上传）</div>
        </div>

        <div class="card">
            <div class="card-title">🧸 今日状态（会同步到聊天顶部卡片）</div>

            <div class="field-label">情绪天气</div>
            <div class="seg" id="mood-weather-seg">
                <button type="button" data-weather="sun">☀️ 晴</button>
                <button type="button" data-weather="rain">🌧️ 雨</button>
                <button type="button" data-weather="thunderstorm">⛈️ 雷暴</button>
            </div>

            <div class="field-label">能量值</div>
            <div class="range-wrap">
                <input id="mood-energy" type="range" min="0" max="100" step="1" />
                <div class="pill" id="mood-energy-pill">15%</div>
            </div>

            <div class="field-label">一句话</div>
            <input class="input" id="mood-note" type="text" placeholder="比如：工作有点不开心" />

            <div class="spacer"></div>
            <div class="row">
                <button class="btn btn-primary" id="mood-save" type="button">保存状态</button>
                <button class="btn btn-ghost" id="mood-reset" type="button">恢复默认</button>
            </div>
            <div class="spacer"></div>
            <div class="muted">提示：你问 AI 时，会自动把这里的最新状态作为上下文一起带过去。</div>
        </div>

        <div class="card">
            <div class="card-title">🗓️ 当天计划</div>
            <div class="muted">已选日期：<span id="cal-selected-date">-</span></div>

            <div class="spacer"></div>
            <div class="row">
                <input class="input" id="event-time" type="time" style="max-width: 140px;" />
                <input class="input" id="event-title" type="text" placeholder="比如：下班给她打电话 / 点奶茶" />
            </div>
            <div class="spacer"></div>
            <div class="row">
                <button class="btn btn-primary" id="event-add" type="button">新增计划</button>
                <button class="btn btn-ghost" id="event-add-reunion" type="button">标记为下次见面</button>
            </div>

            <div class="spacer"></div>
            <div id="event-list"></div>
        </div>
    </div>

    <!-- ============ PAGE: DIARY / TIMELINE ============ -->
    <div id="page-diary" class="page hidden">
        <div class="card">
            <div class="card-title">📝 共享时光轴</div>
            <div class="muted">记录每一个闪光瞬间（今天版本：文字 + 时间，支持删除；只保存在本机）</div>

            <div class="field-label">写一条</div>
            <textarea class="textarea" id="tl-text" placeholder="比如：她今天说好累，我回了：不讲道理，只抱抱 🫶"></textarea>

            <div class="spacer"></div>
            <div class="row-wrap">
                <button class="btn btn-primary" id="tl-add" type="button">发布瞬间</button>
                <button class="btn btn-ghost btn-small" id="tl-add-from-mood" type="button">把当前状态写进时光轴</button>
                <button class="btn btn-ghost btn-small" id="tl-clear" type="button">清空时光轴</button>
            </div>
        </div>

        <div class="card" style="margin-bottom: 120px;">
            <div class="card-title">✨ 时间线</div>
            <div id="tl-list"></div>
        </div>
    </div>

    <!-- ============ PAGE: SETTINGS ============ -->
    <div id="page-settings" class="page hidden">
        
<div class="card">
    <div class="card-title">🎨 头像 & 背景</div>

    <div class="row" style="display:flex; gap:12px; align-items:center; margin-top:10px;">
        <div id="st-avatar-preview" class="avatar-preview"></div>
        <div style="flex:1;">
            <div class="muted">你自己的头像（只影响你这台手机显示）</div>
            <label class="btn btn-ghost btn-small" style="display:inline-flex; gap:8px; align-items:center; cursor:pointer; margin-top:8px;">
                上传头像
                <input id="st-avatar" type="file" accept="image/*" style="display:none;" />
            </label>
            <button class="btn btn-ghost btn-small" id="st-avatar-clear" type="button" style="margin-left:8px;">清除</button>
        </div>
    </div>

    <div class="spacer"></div>

    <div class="field-label">背景主题</div>
    <select class="input" id="st-bg-theme">
        <option value="warm">奶油暖色</option>
        <option value="blush">粉雾日落</option>
        <option value="ocean">海盐清爽</option>
        <option value="night">深夜模式</option>
    </select>

    <div class="field-label" style="margin-top:10px;">自定义背景图（两个人都会看到）</div>
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <label class="btn btn-ghost btn-small" style="display:inline-flex; gap:8px; align-items:center; cursor:pointer;">
            上传背景
            <input id="st-bg-image" type="file" accept="image/*" style="display:none;" />
        </label>
        <button class="btn btn-ghost btn-small" id="st-bg-clear" type="button">清除背景</button>
        <div class="muted" style="font-size:12px;">建议用小图（< 250KB），否则同步会慢。</div>
    </div>
</div>

<div class="card">
            <div class="card-title">⚙️ 偏好设置</div>

            <div class="field-label">在一起日期</div>
            <input class="input" id="st-together" type="date" />

            <div class="field-label">下次见面时间</div>
            <input class="input" id="st-nextmeet" type="datetime-local" />

            <div class="field-label">最喜欢的东西</div>
            <input class="input" id="st-drink" type="text" placeholder="比如：拍立得 / 海边散步" />

            <div class="field-label">喜好清单（最多 5 个，用于小熊提示轮播）</div>
            <input class="input" id="st-like1" type="text" placeholder="比如：草莓蛋糕" />
            <div class="spacer"></div>
            <input class="input" id="st-like2" type="text" placeholder="比如：周末睡懒觉" />
            <div class="spacer"></div>
            <input class="input" id="st-like3" type="text" placeholder="比如：海边散步" />
            <div class="spacer"></div>
            <input class="input" id="st-like4" type="text" placeholder="比如：小众电影" />
            <div class="spacer"></div>
            <input class="input" id="st-like5" type="text" placeholder="比如：清爽香水" />

            <div class="spacer"></div>
            <div class="row-wrap">
                <button class="btn btn-primary" id="st-save" type="button">保存设置</button>
                <button class="btn btn-ghost" id="st-reset" type="button">恢复默认</button>
            </div>

            <div class="spacer"></div>
            <div class="muted">DeepSeek Key 不在前端存（安全），放在云端环境变量里。</div>
        </div>

        <div class="card">
            <div class="card-title">💕 情侣匹配码</div>
            <div class="field-label">匹配码</div>
            <input class="input" id="st-couplecode" type="text" placeholder="比如：PAIR-001" />
            <div class="spacer"></div>
            <div class="row-wrap">
                <button class="btn btn-ghost btn-small" id="couple-copy" type="button">复制</button>
                <button class="btn btn-ghost btn-small" id="couple-clear" type="button">清空</button>
                <button class="btn btn-primary btn-small" id="couple-save" type="button">保存</button>
            </div>
            <div class="spacer"></div>
            <div class="muted" id="couple-status">未保存</div>
        </div>

        <div class="card">
            <div class="card-title">🧾 数据</div>
            <div class="row-wrap">
                <button class="btn btn-ghost" id="st-export" type="button">导出 JSON</button>
                <label class="btn btn-ghost" style="display:inline-flex; gap:8px; align-items:center; cursor:pointer;">
                    导入 JSON
                    <input id="st-import" type="file" accept="application/json" style="display:none;" />
                </label>
                <button class="btn btn-danger" id="st-wipe" type="button">清空全部数据</button>
            </div>
            <div class="spacer"></div>
            <div class="muted">包含：状态、日历计划、时光轴、聊天记录、设置。</div>
        </div>

        <div class="card" style="margin-bottom: 120px;">
            <div class="card-title">ℹ️ 当前</div>
            <div class="muted" id="st-debug"></div>
        </div>
    </div>

    <div id="poke-overlay" class="poke-overlay hidden">
        <canvas id="poke-fx" class="poke-fx"></canvas>
        <button id="poke-close" class="poke-close" type="button" aria-label="关闭">×</button>
        <div class="poke-heart">💗</div>
        <div class="poke-text">Ta 拍了拍你</div>
        <button id="poke-ok" class="btn btn-primary btn-small" type="button">收到啦</button>
    </div>

    <div id="cropper-overlay" class="cropper-overlay hidden">
        <div class="cropper-card">
            <div class="cropper-title" id="cropper-title">裁剪</div>
            <div class="cropper-stage" id="cropper-stage">
                <canvas id="cropper-canvas" class="cropper-canvas"></canvas>
            </div>
            <div class="cropper-row">
                <canvas id="cropper-preview" class="cropper-preview"></canvas>
                <input id="cropper-zoom" type="range" min="1" max="3" step="0.01" value="1" />
            </div>
            <div class="cropper-actions">
                <button class="btn btn-ghost" id="cropper-cancel" type="button">取消</button>
                <button class="btn btn-primary" id="cropper-confirm" type="button">确认</button>
            </div>
        </div>
    </div>


</div>

<nav class="navbar">
    <button id="tab-home" class="nav-item active" type="button">🏠</button>
    <button id="tab-calendar" class="nav-item" type="button">📅</button>
    <button id="tab-diary" class="nav-item" type="button">📝</button>
    <button id="tab-chat" class="nav-item" type="button">💬</button>
    <button id="tab-settings" class="nav-item" type="button">⚙️</button>
</nav>



  </div>
</template>

<script setup>
import { onMounted } from 'vue'

const ensureLegacyScript = () => {
  if (document.getElementById('legacy-app-script')) return
  const script = document.createElement('script')
  script.id = 'legacy-app-script'
  script.src = '/app.js'
  script.defer = true
  document.body.appendChild(script)
}

onMounted(() => {
  ensureLegacyScript()
})
</script>

