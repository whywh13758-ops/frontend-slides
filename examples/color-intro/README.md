# 多彩开场 · Color Intro (30 s)

一段 30 秒、1920×1080、30fps 的多彩酷炫开场视频，带同步配乐（120 BPM，转场卡点）。

| 时间 | 场景 |
|---|---|
| 0–4s | **一束光** — 光点爆发成彩虹光线与色环 |
| 4–9s | **棱镜** — 白光穿过三棱镜分解成光谱 |
| 9–15s | **色彩星系** — 彩色粒子旋涡汇聚成「色彩」，再炸开 |
| 15–21s | **色彩节拍** — 红橙黄绿青蓝紫整屏卡点切换 + 高速彩条 |
| 21–26s | **万花筒隧道** — 彩色多边形环向镜头飞来 |
| 26–30s | **片名** — 「多彩开场 · COLOR YOUR WORLD」彩虹渐变字 |

- `color-intro.mp4` — 成片
- `index.html` — 动画源（直接用浏览器打开即可循环预览）
- `soundtrack.py` — 配乐合成（numpy）
- `render.mjs` — 逐帧导出 MP4（Playwright + ffmpeg）

重新导出：

```bash
python3 soundtrack.py sound.wav
AUDIO=sound.wav node render.mjs color-intro.mp4 30
```

想改文字/配色：编辑 `index.html` 里的 `RAINBOW`、`BEAT_WORDS` 和 `sceneTitle` 中的 `chars`。
