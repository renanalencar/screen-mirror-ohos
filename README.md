# ScreenMirror - 手机投屏到 PC

基于 WebRTC 和 OpenHarmony，将手机画面实时投屏到电脑浏览器。

## 功能

- 手机屏幕实时采集（通过 getDisplayMedia）
- H.264 硬件编码，720p/1080p 自适应
- PC 浏览器接收，支持全屏、撑满、旋转
- 局域网低延迟（< 200ms）

## 架构

```
手机 (HarmonyOS App) --WebRTC--> PC 浏览器
                    |
              信令服务器 (Node.js WebSocket)
```

## 依赖

### 手机端

- DevEco Studio 5.0+
- HarmonyOS SDK API 12+
- [@ohos/webrtc](https://ohpm.openharmony.cn/#/package/@ohos/webrtc) HAR 包
- 自行编译 libohos_webrtc.so（见下方说明）

### 信令服务器

- Node.js 18+
- npm install ws

### PC 接收端

- Chrome / Edge 浏览器（支持 WebRTC）

## 快速开始

### 1. 编译 WebRTC Native 库

参考 ohos_webrtc 官方文档，需要：

- WSL2 + Ubuntu 22.04
- OpenHarmony SDK（含 LLVM 工具链）
- depot_tools

```bash
cd ohos_webrtc
./build.sh /path/to/ohos-sdk/native
# 产出 libohos_webrtc.so → 放到 entry/libs/arm64-v8a/
```

### 2. 启动信令服务器和接收端

```bash
cd signaling-server
npm install
cd ..
# 双击 start.bat（或手动 node signaling-server/server.js）
```

### 3. 部署手机 App

1. DevEco Studio 打开本项目
2. 将编译好的 libohos_webrtc.so 放入 entry/libs/arm64-v8a/
3. 从 OpenHarmony SDK 复制 libc++_shared.so 到同目录
4. 签名 → Run 到真机

### 4. 开始投屏

1. 确保手机和电脑在同一 WiFi
2. PC 浏览器打开 web-receiver/index.html
3. 手机打开 App → 点击"开始投屏"
4. PC 画面出现手机屏幕

## 快捷键

| 按键 | 功能 |
|------|------|
| F | 全屏切换 |
| R | 旋转 90° |
| C | 撑满/自适应切换 |
| 双击画面 | 全屏 |

## 文件说明

| 目录 | 说明 |
|------|------|
| entry/ | HarmonyOS App 源码（ArkTS） |
| signaling-server/ | WebSocket 信令服务器 |
| web-receiver/ | PC 浏览器接收页面 |
| start.bat | 一键启动脚本 |

## 截图

见 [docs/screenshots/](docs/screenshots/)

## 开源协议

MIT License

## 致谢

- [@ohos/webrtc](https://ohpm.openharmony.cn/#/package/@ohos/webrtc) — OpenHarmony WebRTC SDK
- Google WebRTC — 底层音视频引擎
- OpenHarmony — 操作系统平台
