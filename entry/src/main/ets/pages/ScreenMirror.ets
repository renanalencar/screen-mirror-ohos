/**
 * 手机投屏 - 发送端页面 (OpenHarmony ArkTS)
 *
 * 前置条件：
 *   1. 信令服务器已启动 (ws://PC_IP:8080)
 *   2. PC 浏览器已打开接收页面 (web-receiver/index.html)
 */

import webrtc from 'ohos_webrtc'
import webSocket from '@ohos.net.webSocket'
import { BusinessError } from '@ohos.base'
import hilog from '@ohos.hilog'

const TAG = 'ScreenMirror'

// ====== 改成你电脑的局域网 IP (192.168.x.x) ======
const SIGNALING_URL = 'ws://113.54.205.156:8080'

// ====== 信令消息类型定义 ======
interface SignalingMsg {
  type: string
  sdp?: string
  candidate?: object
  message?: string
  peers?: number
}

interface IceCandidateMsg {
  type: string
  candidate: object
}

interface OfferMsg {
  type: string
  sdp: string
}

const ICE_SERVERS: webrtc.RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}

@Entry
@Component
struct ScreenMirror {
  @State statusText: string = '未连接'
  @State isCasting: boolean = false
  @State connectionState: string = ''

  private factory: webrtc.PeerConnectionFactory | null = null
  private pc: webrtc.RTCPeerConnection | null = null
  private ws: webSocket.WebSocket | null = null
  private localStream: webrtc.MediaStream | null = null

  aboutToAppear(): void {
    hilog.info(0x0000, TAG, '页面初始化')
  }

  /**
   * 建立 WebSocket 信令连接
   */
  async connectSignaling(): Promise<webSocket.WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = webSocket.createWebSocket()
      ws.connect(SIGNALING_URL, (err: BusinessError, value: boolean) => {
        if (err) {
          const msg: string = err.message || err.name || '连接超时'
          hilog.error(0x0000, TAG, 'WebSocket失败: ' + msg)
          reject(new Error(msg))
          return
        }
        console.info(TAG, 'WebSocket 已连接')
        this.statusText = '信令已连接，等待配对...'
        resolve(ws)
      })
    })
  }

  /**
   * 通过 WebSocket 发送信令消息
   */
  sendSignaling(msg: IceCandidateMsg | OfferMsg): void {
    if (this.ws) {
      this.ws.send(JSON.stringify(msg), (err: BusinessError) => {
        if (err) {
          console.error(TAG, '发送失败:', err.message)
        }
      })
    }
  }

  /**
   * 处理信令消息
   */
  async handleSignalingMessage(msg: string): Promise<void> {
    const data: SignalingMsg = JSON.parse(msg) as SignalingMsg
    console.info(TAG, `[信令] ← ${data.type}`)

    switch (data.type) {
      case 'ready':
        this.statusText = '配对成功，开始采集屏幕...'
        await this.startCapture()
        break

      case 'answer':
        if (this.pc && data.sdp) {
          await this.pc.setRemoteDescription(
            new webrtc.RTCSessionDescription({ type: 'answer', sdp: data.sdp })
          )
          this.statusText = '连接建立中...'
        }
        break

      case 'ice-candidate':
        if (this.pc && data.candidate) {
          await this.pc.addIceCandidate(data.candidate as webrtc.RTCIceCandidateInit)
        }
        break

      case 'peer-disconnected':
        this.statusText = '接收端已断开'
        this.isCasting = false
        break
    }
  }

  /**
   * 开始屏幕采集 + 投屏
   */
  async startCapture(): Promise<void> {
    try {
      if (!this.factory) {
        this.factory = new webrtc.PeerConnectionFactory()
      }

      // 屏幕采集
      const mediaDevices = new webrtc.MediaDevices()
      const options: webrtc.DisplayMediaStreamOptions = {
        video: {
          width: { ideal: 2560 },
          height: { ideal: 1440 },
          frameRate: { ideal: 30, min: 15 }
        }
      }
      this.localStream = await mediaDevices.getDisplayMedia(options)

      const videoTracks = this.localStream.getVideoTracks()
      hilog.info(0x0000, TAG, '屏幕采集成功，轨数: ' + videoTracks.length)
      this.statusText = '屏幕采集就绪，创建连接...'

      // 创建 PeerConnection — 低延迟配置
      const pcConfig: webrtc.RTCConfiguration = {
        iceServers: ICE_SERVERS.iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      }
      this.pc = this.factory.createPeerConnection(pcConfig)

      // 添加视频 track — 高码率低延迟编码
      for (const track of videoTracks) {
        const sender: webrtc.RTCRtpSender = this.pc.addTrack(track, this.localStream)
        const params: webrtc.RTCRtpSendParameters = sender.getParameters()
        if (params.encodings && params.encodings.length > 0) {
          params.encodings[0].maxBitrate = 8000000     // 8 Mbps
          params.encodings[0].maxFramerate = 30
          params.encodings[0].scaleResolutionDownBy = 1.0
          sender.setParameters(params)
        }
        hilog.info(0x0000, TAG, '已添加视频 track: ' + track.kind)
      }

      // ICE 候选事件
      this.pc.onicecandidate = (event: webrtc.RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          const iceMsg: IceCandidateMsg = {
            type: 'ice-candidate',
            candidate: event.candidate
          }
          this.sendSignaling(iceMsg)
        }
      }

      // 连接状态事件
      this.pc.oniceconnectionstatechange = () => {
        if (this.pc) {
          const state: string = this.pc.iceConnectionState
          console.info(TAG, 'ICE 状态:', state)
          this.connectionState = state
          if (state === 'connected') {
            this.isCasting = true
            this.statusText = '投屏中'
          } else if (state === 'disconnected' || state === 'failed') {
            this.isCasting = false
            this.statusText = '连接断开'
          }
        }
      }

      // 创建 Offer
      const offer: webrtc.RTCSessionDescriptionInit = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)

      const offerMsg: OfferMsg = {
        type: 'offer',
        sdp: offer.sdp as string
      }
      this.sendSignaling(offerMsg)

      this.statusText = '已发送投屏请求，等待接收端响应...'
    } catch (err) {
      const error = err as BusinessError
      const msg: string = error.message || error.name || JSON.stringify(err)
      hilog.error(0x0000, TAG, '采集失败: ' + msg)
      this.statusText = '采集失败: ' + msg
    }
  }

  /**
   * 开始投屏按钮
   */
  async startMirroring(): Promise<void> {
    try {
      this.statusText = '连接信令服务器...'
      this.ws = await this.connectSignaling()

      this.ws.on('message', (err: BusinessError, value: string | ArrayBuffer) => {
        if (err) {
          console.error(TAG, '接收消息错误:', err.message)
          return
        }
        this.handleSignalingMessage(value as string)
      })

      this.ws.on('close', (_err: BusinessError) => {
        console.info(TAG, '信令断开')
        this.statusText = '信令已断开'
        this.isCasting = false
      })

      this.ws.on('error', (err: BusinessError) => {
        console.error(TAG, '信令错误:', err.message)
        this.statusText = `连接失败: ${err.message}`
      })
    } catch (err) {
      const error = err as BusinessError
      const msg: string = error.message || error.name || JSON.stringify(err)
      hilog.error(0x0000, TAG, '启动失败: ' + msg)
      this.statusText = '启动失败: ' + msg
    }
  }

  /**
   * 停止投屏
   */
  stopMirroring(): void {
    try {
      if (this.pc) {
        this.pc.close()
        this.pc = null
      }
    } catch (_e) {
      // ignore
    }
    if (this.localStream) {
      const tracks = this.localStream.getVideoTracks()
      tracks.forEach(t => t.stop())
      this.localStream = null
    }
    try {
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
    } catch (_e) {
      // ignore close errors
    }
    this.isCasting = false
    this.statusText = '已停止'
  }

  build() {
    Column({ space: 20 }) {
      Text('屏幕投屏')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 40 })

      Text(this.statusText)
        .fontSize(18)
        .fontColor(this.isCasting ? '#53d769' : '#ffc107')
        .textAlign(TextAlign.Center)
        .width('80%')
        .padding(10)
        .backgroundColor('#16213e')
        .borderRadius(8)

      if (this.connectionState) {
        Text('ICE: ' + this.connectionState)
          .fontSize(12)
          .fontColor('#888')
      }

      if (this.isCasting) {
        Column() {
          Text('手机画面投屏中')
            .fontSize(14)
            .fontColor('#53d769')
        }
        .width('80%')
        .height(160)
        .backgroundColor('#16213e')
        .borderRadius(12)
        .justifyContent(FlexAlign.Center)
      }

      if (!this.isCasting) {
        Button('开始投屏')
          .fontSize(18)
          .width('60%')
          .height(48)
          .backgroundColor('#0f3460')
          .borderRadius(24)
          .onClick(() => this.startMirroring())
      } else {
        Button('停止投屏')
          .fontSize(18)
          .width('60%')
          .height(48)
          .backgroundColor('#c0392b')
          .borderRadius(24)
          .onClick(() => this.stopMirroring())
      }

      Text('信令服务器: ' + SIGNALING_URL)
        .fontSize(11)
        .fontColor('#666')
        .textAlign(TextAlign.Center)
        .margin({ bottom: 30 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#1a1a2e')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }
}
