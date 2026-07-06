/**
 * Screen Mirroring - Sender (OpenHarmony ArkTS)
 *
 * Prerequisites:
 *   1. Signaling server is running (ws://PC_IP:8080)
 *   2. PC browser has the receiver page open (web-receiver/index.html)
 */

import webrtc from '@ohos/webrtc'
import webSocket from '@ohos.net.webSocket'
import { BusinessError } from '@ohos.base'
import hilog from '@ohos.hilog'

const TAG = 'ScreenMirror'

// ====== Signaling server defaults ======
// The user can override the host at runtime in the app. A bare host uses this
// default port; a "host:port" value overrides it.
const DEFAULT_SIGNALING_HOST = '192.168.0.131'
const DEFAULT_SIGNALING_PORT = 8080

// ====== Signaling message type definition ======
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
  @State statusText: string = 'Not Connected'
  @State isCasting: boolean = false
  @State connectionState: string = ''
  @State signalingHost: string = DEFAULT_SIGNALING_HOST

  private factory: webrtc.PeerConnectionFactory | null = null
  private pc: webrtc.RTCPeerConnection | null = null
  private ws: webSocket.WebSocket | null = null
  private localStream: webrtc.MediaStream | null = null

  aboutToAppear(): void {
    hilog.info(0x0000, TAG, 'Page initialized')
  }

  /**
   * Build the signaling WebSocket URL from the user-entered host.
   * Accepts a bare host ("192.168.0.131") or "host:port"; falls back to the
   * default host/port when the field is left blank.
   */
  buildSignalingUrl(): string {
    let host: string = this.signalingHost.trim()
    if (host.length === 0) {
      host = DEFAULT_SIGNALING_HOST
    }
    // Only append the default port when the user didn't specify their own.
    const hasPort: boolean = host.indexOf(':') >= 0
    const authority: string = hasPort ? host : `${host}:${DEFAULT_SIGNALING_PORT}`
    return `ws://${authority}/?role=sender`
  }

  /**
   * Establish WebSocket signaling connection
   */
  async connectSignaling(): Promise<webSocket.WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = webSocket.createWebSocket()
      const url: string = this.buildSignalingUrl()
      hilog.info(0x0000, TAG, 'Connecting to ' + url)
      ws.connect(url, (err: BusinessError, value: boolean) => {
        if (err) {
          const msg: string = err.message || err.name || 'Connection timeout'
          hilog.error(0x0000, TAG, 'WebSocket failed: ' + msg)
          reject(new Error(msg))
          return
        }
        console.info(TAG, 'WebSocket connected')
        this.statusText = 'Signaling connected, waiting for pairing...'
        resolve(ws)
      })
    })
  }

  /**
   * Send signaling message via WebSocket
   */
  sendSignaling(msg: IceCandidateMsg | OfferMsg): void {
    if (this.ws) {
      this.ws.send(JSON.stringify(msg), (err: BusinessError) => {
        if (err) {
          console.error(TAG, 'Send failed:', err.message)
        }
      })
    }
  }

  /**
   * Handle signaling messages
   */
  async handleSignalingMessage(msg: string): Promise<void> {
    const data: SignalingMsg = JSON.parse(msg) as SignalingMsg
    console.info(TAG, `[Signaling] ← ${data.type}`)

    switch (data.type) {
      case 'ready':
        this.statusText = 'Pairing successful, starting screen capture...'
        await this.startCapture()
        break

      case 'answer':
        if (this.pc && data.sdp) {
          await this.pc.setRemoteDescription(
            new webrtc.RTCSessionDescription({ type: 'answer', sdp: data.sdp })
          )
          this.statusText = 'Establishing connection...'
        }
        break

      case 'ice-candidate':
        if (this.pc && data.candidate) {
          await this.pc.addIceCandidate(data.candidate as webrtc.RTCIceCandidateInit)
        }
        break

      case 'peer-disconnected':
        this.statusText = 'Receiver disconnected'
        this.isCasting = false
        break
    }
  }

  /**
   * Start screen capture + mirroring
   */
  async startCapture(): Promise<void> {
    try {
      if (!this.factory) {
        this.factory = new webrtc.PeerConnectionFactory()
      }

      // Screen capture
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
      hilog.info(0x0000, TAG, 'Screen capture successful, tracks: ' + videoTracks.length)
      this.statusText = 'Screen capture ready, creating connection...'

      // Create PeerConnection — low latency config
      const pcConfig: webrtc.RTCConfiguration = {
        iceServers: ICE_SERVERS.iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      }
      this.pc = this.factory.createPeerConnection(pcConfig)

      // Add video track — high bitrate low latency encoding
      for (const track of videoTracks) {
        const sender: webrtc.RTCRtpSender = this.pc.addTrack(track, this.localStream)
        const params: webrtc.RTCRtpSendParameters = sender.getParameters()
        if (params.encodings && params.encodings.length > 0) {
          params.encodings[0].maxBitrate = 8000000     // 8 Mbps
          params.encodings[0].maxFramerate = 30
          params.encodings[0].scaleResolutionDownBy = 1.0
          sender.setParameters(params)
        }
        hilog.info(0x0000, TAG, 'Added video track: ' + track.kind)
      }

      // ICE candidate event
      this.pc.onicecandidate = (event: webrtc.RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          const iceMsg: IceCandidateMsg = {
            type: 'ice-candidate',
            candidate: event.candidate
          }
          this.sendSignaling(iceMsg)
        }
      }

      // Connection state event
      this.pc.oniceconnectionstatechange = () => {
        if (this.pc) {
          const state: string = this.pc.iceConnectionState
          console.info(TAG, 'ICE state:', state)
          this.connectionState = state
          if (state === 'connected') {
            this.isCasting = true
            this.statusText = 'Mirroring'
          } else if (state === 'disconnected' || state === 'failed') {
            this.isCasting = false
            this.statusText = 'Disconnected'
          }
        }
      }

      // Create Offer
      const offer: webrtc.RTCSessionDescriptionInit = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)

      const offerMsg: OfferMsg = {
        type: 'offer',
        sdp: offer.sdp as string
      }
      this.sendSignaling(offerMsg)

      this.statusText = 'Sent mirroring request, waiting for receiver response...'
    } catch (err) {
      const error = err as BusinessError
      const msg: string = error.message || error.name || JSON.stringify(err)
      hilog.error(0x0000, TAG, 'Capture failed: ' + msg)
      this.statusText = 'Capture failed: ' + msg
    }
  }

  /**
   * Start mirroring button
   */
  async startMirroring(): Promise<void> {
    try {
      this.statusText = 'Connecting to signaling server...'
      this.ws = await this.connectSignaling()

      this.ws.on('message', (err: BusinessError, value: string | ArrayBuffer) => {
        if (err) {
          console.error(TAG, 'Message receiving error:', err.message)
          return
        }
        this.handleSignalingMessage(value as string)
      })

      this.ws.on('close', (_err: BusinessError) => {
        console.info(TAG, 'Signaling disconnected')
        this.statusText = 'Signaling disconnected'
        this.isCasting = false
      })

      this.ws.on('error', (err: BusinessError) => {
        console.error(TAG, 'Signaling error:', err.message || JSON.stringify(err))
        this.statusText = `Connection failed: ${err.message || err.name || 'Unknown error'}`
      })
    } catch (err) {
      const error = err as BusinessError
      const msg: string = error.message || error.name || JSON.stringify(err)
      hilog.error(0x0000, TAG, 'Start failed: ' + msg)
      this.statusText = 'Start failed: ' + msg
    }
  }

  /**
   * Stop mirroring
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
    this.statusText = 'Stopped'
  }

  build() {
    Column({ space: 20 }) {
      Text('Screen Mirroring')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.text_primary'))
        .margin({ top: 40 })

      Text(this.statusText)
        .fontSize(18)
        .fontColor(this.isCasting ? $r('app.color.success') : $r('app.color.warning'))
        .textAlign(TextAlign.Center)
        .width('80%')
        .padding(10)
        .backgroundColor($r('app.color.surface'))
        .borderRadius(8)

      if (this.connectionState) {
        Text('ICE: ' + this.connectionState)
          .fontSize(12)
          .fontColor($r('app.color.text_secondary'))
      }

      if (this.isCasting) {
        Column() {
          Text('Mobile screen mirroring in progress')
            .fontSize(14)
            .fontColor($r('app.color.success'))
        }
        .width('80%')
        .height(160)
        .backgroundColor($r('app.color.surface'))
        .borderRadius(12)
        .justifyContent(FlexAlign.Center)
      }

      if (!this.isCasting) {
        Column({ space: 6 }) {
          Text('Signaling Server IP')
            .fontSize(13)
            .fontColor($r('app.color.text_secondary'))
            .width('80%')
            .textAlign(TextAlign.Start)

          TextInput({ text: this.signalingHost, placeholder: DEFAULT_SIGNALING_HOST })
            .type(InputType.Normal)
            .fontSize(16)
            .fontColor($r('app.color.text_primary'))
            .width('80%')
            .height(48)
            .backgroundColor($r('app.color.surface'))
            .borderRadius(8)
            .onChange((value: string) => {
              this.signalingHost = value
            })
        }
        .alignItems(HorizontalAlign.Start)

        Button('Start Mirroring')
          .fontSize(18)
          .fontColor(Color.White)
          .width('60%')
          .height(48)
          .backgroundColor($r('app.color.accent'))
          .borderRadius(24)
          .onClick(() => this.startMirroring())
      } else {
        Button('Stop Mirroring')
          .fontSize(18)
          .fontColor(Color.White)
          .width('60%')
          .height(48)
          .backgroundColor($r('app.color.danger'))
          .borderRadius(24)
          .onClick(() => this.stopMirroring())
      }

      Text('Signaling Server: ' + this.buildSignalingUrl())
        .fontSize(11)
        .fontColor($r('app.color.text_tertiary'))
        .textAlign(TextAlign.Center)
        .margin({ bottom: 30 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor($r('app.color.page_background'))
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }
}
