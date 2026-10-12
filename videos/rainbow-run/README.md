# 派星天护节 · 亲子彩虹跑 — 3D 宣传片

1920×1080，30fps，约 55 秒，无声（背景音乐后配）。剪辑点卡 120 BPM（每拍 0.5 秒）。

整片是一个 CSS-3D 天空世界，由一台虚拟摄像机穿行：每个活动段落是悬浮在空中的一组画面，镜头在它们之间推、拉、环绕、甩镜头。第二版视觉：写实积云与太阳光晕、通透彩虹光带、散景光斑、幕布式展开的无框照片卡。

字体：主标题优设标题黑，辅助大字得意黑（Smiley Sans），正文思源黑体，英文 Montserrat（均为可商用开源字体，切片文件在 `fonts/`）。每段文字动效不同：打字机、砸字、翻牌、字距收拢、彩虹流光、左右对冲、霓虹闪烁、跑马灯弹出、结霜模糊到清晰、乱码解密。

## 段落

| 时间 | 段落 |
| --- | --- |
| 0–3s | 开场钩子：听说 吉安周末有大事发生？ |
| 3–9s | 穿云 → 彩虹 → 派星天护节 · 亲子彩虹跑 |
| 9–18s | 01 STAR GUEST：青鸟飞鱼-虎虎（10月17日 明星见面会） |
| 18–26.5s | 02 RAINBOW RUN：亲子彩虹跑 |
| 26.5–34s | 03 PARTY NIGHT：带娃蹦迪 |
| 34–40.5s | 04 SHOWTIME：精彩演出不断 |
| 40.5–47.5s | 05 FROZEN PARTY：冰雪女王 |
| 47.5–55s | 拉远回望 + 落版 |

## 文件

- `index.html` / `style.css` / `main.js` — 画面与时间线（GSAP），浏览器直接打开即可预览：空格暂停，←/→ 跳 2 秒，`?t=12` 定格到某秒。
- `assets/` — 从海报裁出的活动照片、Logo、二维码，以及生成的云朵/彩虹/光线贴图。
- `src/` — 原始海报。
- `render.cjs` — 渲染 MP4：`node render.cjs out/rainbow-run-promo.mp4`（快速运镜处做 4 次子帧采样的动态模糊）。
- `stills.cjs` — 抽帧检查：`node stills.cjs <目录> 3 12.5 40`。
- 云朵、彩虹光带、光线贴图由 Python 程序化生成（见提交记录），已存入 `assets/`。

## 待补

- 虎虎照片已从主海报（`src/p00-huhu.webp`）裁出：`assets/huhu.jpg`（竖图）和 `assets/huhu-face.jpg`（头像）。

## v4（参考片风格，当前版本）

`v4/` 是按客户参考片重做的版本：一个形变元素贯穿全片。流程：搜索框（吉安… → 听说 吉安周末有大事发生？）→ 转圈 / 打勾 → “青鸟飞鱼来了！” → 《此生不换》播放器（点播放、音量拉满后效果炸开）→ 明星嘉宾虎虎（10月17日 明星见面会）→ “周末不止明星，还有更多精彩！” → 手机相册（彩虹跑、带娃蹦迪、精彩演出、冰雪女王，左右滑动）→ 落版（江西 · 吉安）。1080p 60fps，约 49.5 秒。

- 渲染画面：`node render.cjs out/v4.mp4 --page v4/index.html --fps 60 --sub 2`
- 声音：`node audio/dump.cjs v4/index.html audio/cues.json` 导出时间线上的音效点，`python3 audio/make_audio.py audio/cues.json out/soundtrack.wav` 合成音效 + 120 BPM 临时配乐（原创合成、无版权问题；可替换为授权音乐，主歌进入点在音量拉满的 10.72 秒）。
- 合成：`ffmpeg -i out/v4.mp4 -i out/soundtrack.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest out/v4-final.mp4`
