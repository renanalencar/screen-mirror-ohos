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
import preferences from '@ohos.data.preferences'

const TAG = 'ScreenMirror'
const SIGNALING_HOST_KEY = 'signalingHost'
const PREFERENCES_NAME = 'screen_mirror_prefs'

// ====== Signaling server defaults ======
// The user can override the host at runtime in the app. A bare host uses this
// default port; a "host:port" value overrides it.
const DEFAULT_SIGNALING_HOST = 'screen-mirror-backend.onrender.com'
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
  @State showSettings: boolean = false
  @State settingsInput: string = ''

  private factory: webrtc.PeerConnectionFactory | null = null
  private pc: webrtc.RTCPeerConnection | null = null
  private ws: webSocket.WebSocket | null = null
  private localStream: webrtc.MediaStream | null = null
  private preferencesObj: preferences.Preferences | null = null

  /**
   * Load saved signaling host from preferences
   */
  loadSettings(): void {
    try {
      preferences.getPreferences(AppStorage.Get('context'), PREFERENCES_NAME).then((prefs: preferences.Preferences) => {
        this.preferencesObj = prefs
        const savedHost = this.preferencesObj?.getSync(SIGNALING_HOST_KEY, DEFAULT_SIGNALING_HOST) as string
        this.signalingHost = savedHost
        this.settingsInput = savedHost
        hilog.info(0x0000, TAG, `Loaded saved signaling host: ${savedHost}`)
      }).catch((err: BusinessError) => {
        hilog.warn(0x0000, TAG, `Failed to load preferences: ${err.message}`)
        this.signalingHost = DEFAULT_SIGNALING_HOST
        this.settingsInput = DEFAULT_SIGNALING_HOST
      })
    } catch (err) {
      const error = err as BusinessError
      hilog.warn(0x0000, TAG, `Failed to load preferences: ${error.message}`)
      this.signalingHost = DEFAULT_SIGNALING_HOST
      this.settingsInput = DEFAULT_SIGNALING_HOST
    }
  }

  /**
   * Save signaling host to preferences
   */
  saveSettings(): void {
    try {
      if (!this.preferencesObj) {
        preferences.getPreferences(AppStorage.Get('context'), PREFERENCES_NAME).then((prefs: preferences.Preferences) => {
          this.preferencesObj = prefs
          this.preferencesObj?.putSync(SIGNALING_HOST_KEY, this.settingsInput)
          this.preferencesObj?.flush()
          this.signalingHost = this.settingsInput
          hilog.info(0x0000, TAG, `Saved signaling host: ${this.settingsInput}`)
        }).catch((err: BusinessError) => {
          hilog.error(0x0000, TAG, `Failed to save preferences: ${err.message}`)
        })
      } else {
        this.preferencesObj.putSync(SIGNALING_HOST_KEY, this.settingsInput)
        this.preferencesObj.flush()
        this.signalingHost = this.settingsInput
        hilog.info(0x0000, TAG, `Saved signaling host: ${this.settingsInput}`)
      }
    } catch (err) {
      const error = err as BusinessError
      hilog.error(0x0000, TAG, `Failed to save preferences: ${error.message}`)
    }
  }

  aboutToAppear(): void {
    hilog.info(0x0000, TAG, 'Page initialized')
    this.loadSettings()
  }

  /**
   * Build the signaling WebSocket URL from the user-entered host.
   * Accepts a bare host ("192.168.0.131"), "host:port", a full URL,
   * or public hostnames such as "screen-mirror-backend.onrender.com".
   * Local/private hosts default to ws:// and port 8080; public hosts default
   * to wss:// and no extra port.
   */
  buildSignalingUrl(): string {
    let rawValue: string = this.signalingHost.trim()
    if (rawValue.length === 0) {
      rawValue = DEFAULT_SIGNALING_HOST
    }

    const hasProtocol: boolean = rawValue.indexOf('://') >= 0
    if (hasProtocol) {
      const normalizedValue: string = rawValue.endsWith('/') ? rawValue : `${rawValue}/`
      if (normalizedValue.indexOf('?') < 0) {
        return `${normalizedValue}?role=sender`
      }
      return normalizedValue
    }

    let authority: string = rawValue
    let scheme: string = 'ws'
    let path: string = '/?role=sender'

    const pathIndex: number = rawValue.indexOf('/')
    if (pathIndex >= 0) {
      authority = rawValue.substring(0, pathIndex)
      path = rawValue.substring(pathIndex)
      if (path.indexOf('?') < 0) {
        path = `${path}${path.endsWith('/') ? '' : '/'}?role=sender`
      }
    }

    const lowerAuthority: string = authority.toLowerCase()
    const isLocalHost: boolean = lowerAuthority === 'localhost' ||
      lowerAuthority.startsWith('127.') ||
      lowerAuthority.startsWith('10.') ||
      lowerAuthority.startsWith('192.168.') ||
      lowerAuthority.startsWith('172.')

    const hasExplicitPort: boolean = authority.lastIndexOf(':') > authority.lastIndexOf(']') &&
      authority.substring(authority.lastIndexOf(':') + 1).length > 0

    if (!isLocalHost && authority.indexOf('.') >= 0 && !hasExplicitPort) {
      scheme = 'wss'
    } else if (!hasExplicitPort) {
      authority = `${authority}:${DEFAULT_SIGNALING_PORT}`
    }

    return `${scheme}://${authority}${path}`
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
      // Header with title and settings icon
      Row() {
        Text('Screen Mirroring')
          .fontSize(28)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.text_primary'))
      }
      .alignItems(VerticalAlign.Center)
      .margin({ top: 40 })

      // Text(this.statusText)
      //   .fontSize(18)
      //   .fontColor(this.isCasting ? $r('app.color.success') : $r('app.color.warning'))
      //   .textAlign(TextAlign.Center)
      //   .width('80%')
      //   .padding(10)
      //   .backgroundColor($r('app.color.surface'))
      //   .borderRadius(8)

      if (!this.isCasting) {
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

      Button({ type: ButtonType.Circle, stateEffect: true }) {
        SymbolGlyph($r('sys.symbol.gearshape'))
          .fontSize(22)
          .renderingStrategy(SymbolRenderingStrategy.SINGLE)
          .fontColor([$r('sys.color.brand')])
      }
      .width(48)
      .height(48)
      .backgroundColor($r('app.color.surface'))
      .onClick(() => {
        this.settingsInput = this.signalingHost
        this.showSettings = true
      })

      Text(this.statusText)
        .fontSize(11)
        .fontColor($r('app.color.text_tertiary'))
        .textAlign(TextAlign.Center)
        .margin({ bottom: 30 })

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
    }
    .width('100%')
    .height('100%')
    .backgroundColor($r('app.color.page_background'))
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .bindSheet($$this.showSettings, this.settingsSheet(), {
      height: '50%',
      dragBar: true,
      onDisappear: () => {
        this.showSettings = false
      }
    })
  }

  /**
   * Settings Bottom Sheet
   */
  @Builder settingsSheet() {
    Column({ space: 16 }) {
      // Header
      Row() {
        Text('Settings')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.text_primary'))

        Blank()

        Button({ type: ButtonType.Circle, stateEffect: true })
        .width(40)
        .height(40)
        .backgroundColor(Color.Transparent)
        .onClick(() => {
          this.showSettings = false
        })
      }
      .width('90%')
      .justifyContent(FlexAlign.SpaceBetween)
      .alignItems(VerticalAlign.Center)
      .padding({ top: 16 })

      Divider()
        .width('90%')

      // Signaling Server Input
      Column({ space: 8 }) {
        Text('Signaling Server Address')
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.text_primary'))
          .width('90%')
          .textAlign(TextAlign.Start)

        Text('Enter IP, hostname, or full WebSocket URL')
          .fontSize(12)
          .fontColor($r('app.color.text_secondary'))
          .width('90%')
          .textAlign(TextAlign.Start)

        TextInput({ text: this.settingsInput, placeholder: 'e.g., 192.168.0.131' })
          .type(InputType.Normal)
          .fontSize(16)
          .fontColor($r('app.color.text_primary'))
          .width('90%')
          .height(48)
          .backgroundColor($r('app.color.surface'))
          .borderRadius(8)
          .padding({ left: 12, right: 12 })
          .onChange((value: string) => {
            this.settingsInput = value
          })
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
      .padding({ left: 16 })

      Blank()

      // Action Buttons
      Row({ space: 12 }) {
        Button('Cancel')
          .fontSize(16)
          .fontColor($r('app.color.text_primary'))
          .width('48%')
          .height(44)
          .backgroundColor($r('app.color.surface'))
          .borderRadius(8)
          .onClick(() => {
            this.showSettings = false
          })

        Button('Save')
          .fontSize(16)
          .fontColor(Color.White)
          .width('48%')
          .height(44)
          .backgroundColor($r('app.color.accent'))
          .borderRadius(8)
          .onClick(() => {
            this.saveSettings()
            this.showSettings = false
          })
      }
      .width('90%')
      .justifyContent(FlexAlign.Center)
      .padding({ bottom: 16 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
    .backgroundColor($r('app.color.page_background'))
  }
}
