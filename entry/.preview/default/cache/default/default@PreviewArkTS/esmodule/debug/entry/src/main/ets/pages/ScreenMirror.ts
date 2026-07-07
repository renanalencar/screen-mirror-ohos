if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface ScreenMirror_Params {
    statusText?: string;
    isCasting?: boolean;
    connectionState?: string;
    signalingHost?: string;
    showSettings?: boolean;
    settingsInput?: string;
    factory?: webrtc.PeerConnectionFactory | null;
    pc?: webrtc.RTCPeerConnection | null;
    ws?: webSocket.WebSocket | null;
    localStream?: webrtc.MediaStream | null;
    preferencesObj?: preferences.Preferences | null;
}
import webrtc from "@package:pkg_modules/.ohpm/@ohos+webrtc@1.0.2/pkg_modules/@ohos/webrtc/Index";
import webSocket from "@ohos:net.webSocket";
import type { BusinessError } from "@ohos:base";
import hilog from "@ohos:hilog";
import preferences from "@ohos:data.preferences";
const TAG = 'ScreenMirror';
const SIGNALING_HOST_KEY = 'signalingHost';
const PREFERENCES_NAME = 'screen_mirror_prefs';
// ====== Signaling server defaults ======
// The user can override the host at runtime in the app. A bare host uses this
// default port; a "host:port" value overrides it.
const DEFAULT_SIGNALING_HOST = 'screen-mirror-backend.onrender.com';
const DEFAULT_SIGNALING_PORT = 8080;
// ====== Signaling message type definition ======
interface SignalingMsg {
    type: string;
    sdp?: string;
    candidate?: object;
    message?: string;
    peers?: number;
}
interface IceCandidateMsg {
    type: string;
    candidate: object;
}
interface OfferMsg {
    type: string;
    sdp: string;
}
const ICE_SERVERS: webrtc.RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};
class ScreenMirror extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__statusText = new ObservedPropertySimplePU('Not Connected', this, "statusText");
        this.__isCasting = new ObservedPropertySimplePU(false, this, "isCasting");
        this.__connectionState = new ObservedPropertySimplePU('', this, "connectionState");
        this.__signalingHost = new ObservedPropertySimplePU(DEFAULT_SIGNALING_HOST, this, "signalingHost");
        this.__showSettings = new ObservedPropertySimplePU(false, this, "showSettings");
        this.__settingsInput = new ObservedPropertySimplePU('', this, "settingsInput");
        this.factory = null;
        this.pc = null;
        this.ws = null;
        this.localStream = null;
        this.preferencesObj = null;
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: ScreenMirror_Params) {
        if (params.statusText !== undefined) {
            this.statusText = params.statusText;
        }
        if (params.isCasting !== undefined) {
            this.isCasting = params.isCasting;
        }
        if (params.connectionState !== undefined) {
            this.connectionState = params.connectionState;
        }
        if (params.signalingHost !== undefined) {
            this.signalingHost = params.signalingHost;
        }
        if (params.showSettings !== undefined) {
            this.showSettings = params.showSettings;
        }
        if (params.settingsInput !== undefined) {
            this.settingsInput = params.settingsInput;
        }
        if (params.factory !== undefined) {
            this.factory = params.factory;
        }
        if (params.pc !== undefined) {
            this.pc = params.pc;
        }
        if (params.ws !== undefined) {
            this.ws = params.ws;
        }
        if (params.localStream !== undefined) {
            this.localStream = params.localStream;
        }
        if (params.preferencesObj !== undefined) {
            this.preferencesObj = params.preferencesObj;
        }
    }
    updateStateVars(params: ScreenMirror_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__statusText.purgeDependencyOnElmtId(rmElmtId);
        this.__isCasting.purgeDependencyOnElmtId(rmElmtId);
        this.__connectionState.purgeDependencyOnElmtId(rmElmtId);
        this.__signalingHost.purgeDependencyOnElmtId(rmElmtId);
        this.__showSettings.purgeDependencyOnElmtId(rmElmtId);
        this.__settingsInput.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__statusText.aboutToBeDeleted();
        this.__isCasting.aboutToBeDeleted();
        this.__connectionState.aboutToBeDeleted();
        this.__signalingHost.aboutToBeDeleted();
        this.__showSettings.aboutToBeDeleted();
        this.__settingsInput.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __statusText: ObservedPropertySimplePU<string>;
    get statusText() {
        return this.__statusText.get();
    }
    set statusText(newValue: string) {
        this.__statusText.set(newValue);
    }
    private __isCasting: ObservedPropertySimplePU<boolean>;
    get isCasting() {
        return this.__isCasting.get();
    }
    set isCasting(newValue: boolean) {
        this.__isCasting.set(newValue);
    }
    private __connectionState: ObservedPropertySimplePU<string>;
    get connectionState() {
        return this.__connectionState.get();
    }
    set connectionState(newValue: string) {
        this.__connectionState.set(newValue);
    }
    private __signalingHost: ObservedPropertySimplePU<string>;
    get signalingHost() {
        return this.__signalingHost.get();
    }
    set signalingHost(newValue: string) {
        this.__signalingHost.set(newValue);
    }
    private __showSettings: ObservedPropertySimplePU<boolean>;
    get showSettings() {
        return this.__showSettings.get();
    }
    set showSettings(newValue: boolean) {
        this.__showSettings.set(newValue);
    }
    private __settingsInput: ObservedPropertySimplePU<string>;
    get settingsInput() {
        return this.__settingsInput.get();
    }
    set settingsInput(newValue: string) {
        this.__settingsInput.set(newValue);
    }
    private factory: webrtc.PeerConnectionFactory | null;
    private pc: webrtc.RTCPeerConnection | null;
    private ws: webSocket.WebSocket | null;
    private localStream: webrtc.MediaStream | null;
    private preferencesObj: preferences.Preferences | null;
    /**
     * Load saved signaling host from preferences
     */
    loadSettings(): void {
        try {
            preferences.getPreferences(AppStorage.Get('context'), PREFERENCES_NAME).then((prefs: preferences.Preferences) => {
                this.preferencesObj = prefs;
                const savedHost = this.preferencesObj?.getSync(SIGNALING_HOST_KEY, DEFAULT_SIGNALING_HOST) as string;
                this.signalingHost = savedHost;
                this.settingsInput = savedHost;
                hilog.info(0x0000, TAG, `Loaded saved signaling host: ${savedHost}`);
            }).catch((err: BusinessError) => {
                hilog.warn(0x0000, TAG, `Failed to load preferences: ${err.message}`);
                this.signalingHost = DEFAULT_SIGNALING_HOST;
                this.settingsInput = DEFAULT_SIGNALING_HOST;
            });
        }
        catch (err) {
            const error = err as BusinessError;
            hilog.warn(0x0000, TAG, `Failed to load preferences: ${error.message}`);
            this.signalingHost = DEFAULT_SIGNALING_HOST;
            this.settingsInput = DEFAULT_SIGNALING_HOST;
        }
    }
    /**
     * Save signaling host to preferences
     */
    saveSettings(): void {
        try {
            if (!this.preferencesObj) {
                preferences.getPreferences(AppStorage.Get('context'), PREFERENCES_NAME).then((prefs: preferences.Preferences) => {
                    this.preferencesObj = prefs;
                    this.preferencesObj?.putSync(SIGNALING_HOST_KEY, this.settingsInput);
                    this.preferencesObj?.flush();
                    this.signalingHost = this.settingsInput;
                    hilog.info(0x0000, TAG, `Saved signaling host: ${this.settingsInput}`);
                }).catch((err: BusinessError) => {
                    hilog.error(0x0000, TAG, `Failed to save preferences: ${err.message}`);
                });
            }
            else {
                this.preferencesObj.putSync(SIGNALING_HOST_KEY, this.settingsInput);
                this.preferencesObj.flush();
                this.signalingHost = this.settingsInput;
                hilog.info(0x0000, TAG, `Saved signaling host: ${this.settingsInput}`);
            }
        }
        catch (err) {
            const error = err as BusinessError;
            hilog.error(0x0000, TAG, `Failed to save preferences: ${error.message}`);
        }
    }
    aboutToAppear(): void {
        hilog.info(0x0000, TAG, 'Page initialized');
        this.loadSettings();
    }
    /**
     * Build the signaling WebSocket URL from the user-entered host.
     * Accepts a bare host ("192.168.0.131"), "host:port", a full URL,
     * or public hostnames such as "screen-mirror-backend.onrender.com".
     * Local/private hosts default to ws:// and port 8080; public hosts default
     * to wss:// and no extra port.
     */
    buildSignalingUrl(): string {
        let rawValue: string = this.signalingHost.trim();
        if (rawValue.length === 0) {
            rawValue = DEFAULT_SIGNALING_HOST;
        }
        const hasProtocol: boolean = rawValue.indexOf('://') >= 0;
        if (hasProtocol) {
            const normalizedValue: string = rawValue.endsWith('/') ? rawValue : `${rawValue}/`;
            if (normalizedValue.indexOf('?') < 0) {
                return `${normalizedValue}?role=sender`;
            }
            return normalizedValue;
        }
        let authority: string = rawValue;
        let scheme: string = 'ws';
        let path: string = '/?role=sender';
        const pathIndex: number = rawValue.indexOf('/');
        if (pathIndex >= 0) {
            authority = rawValue.substring(0, pathIndex);
            path = rawValue.substring(pathIndex);
            if (path.indexOf('?') < 0) {
                path = `${path}${path.endsWith('/') ? '' : '/'}?role=sender`;
            }
        }
        const lowerAuthority: string = authority.toLowerCase();
        const isLocalHost: boolean = lowerAuthority === 'localhost' ||
            lowerAuthority.startsWith('127.') ||
            lowerAuthority.startsWith('10.') ||
            lowerAuthority.startsWith('192.168.') ||
            lowerAuthority.startsWith('172.');
        const hasExplicitPort: boolean = authority.lastIndexOf(':') > authority.lastIndexOf(']') &&
            authority.substring(authority.lastIndexOf(':') + 1).length > 0;
        if (!isLocalHost && authority.indexOf('.') >= 0 && !hasExplicitPort) {
            scheme = 'wss';
        }
        else if (!hasExplicitPort) {
            authority = `${authority}:${DEFAULT_SIGNALING_PORT}`;
        }
        return `${scheme}://${authority}${path}`;
    }
    /**
     * Establish WebSocket signaling connection
     */
    async connectSignaling(): Promise<webSocket.WebSocket> {
        return new Promise((resolve, reject) => {
            const ws = webSocket.createWebSocket();
            const url: string = this.buildSignalingUrl();
            hilog.info(0x0000, TAG, 'Connecting to ' + url);
            ws.connect(url, (err: BusinessError, value: boolean) => {
                if (err) {
                    const msg: string = err.message || err.name || 'Connection timeout';
                    hilog.error(0x0000, TAG, 'WebSocket failed: ' + msg);
                    reject(new Error(msg));
                    return;
                }
                console.info(TAG, 'WebSocket connected');
                this.statusText = 'Signaling connected, waiting for pairing...';
                resolve(ws);
            });
        });
    }
    /**
     * Send signaling message via WebSocket
     */
    sendSignaling(msg: IceCandidateMsg | OfferMsg): void {
        if (this.ws) {
            this.ws.send(JSON.stringify(msg), (err: BusinessError) => {
                if (err) {
                    console.error(TAG, 'Send failed:', err.message);
                }
            });
        }
    }
    /**
     * Handle signaling messages
     */
    async handleSignalingMessage(msg: string): Promise<void> {
        const data: SignalingMsg = JSON.parse(msg) as SignalingMsg;
        console.info(TAG, `[Signaling] ← ${data.type}`);
        switch (data.type) {
            case 'ready':
                this.statusText = 'Pairing successful, starting screen capture...';
                await this.startCapture();
                break;
            case 'answer':
                if (this.pc && data.sdp) {
                    await this.pc.setRemoteDescription(new webrtc.RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
                    this.statusText = 'Establishing connection...';
                }
                break;
            case 'ice-candidate':
                if (this.pc && data.candidate) {
                    await this.pc.addIceCandidate(data.candidate as webrtc.RTCIceCandidateInit);
                }
                break;
            case 'peer-disconnected':
                this.statusText = 'Receiver disconnected';
                this.isCasting = false;
                break;
        }
    }
    /**
     * Start screen capture + mirroring
     */
    async startCapture(): Promise<void> {
        try {
            if (!this.factory) {
                this.factory = new webrtc.PeerConnectionFactory();
            }
            // Screen capture
            const mediaDevices = new webrtc.MediaDevices();
            const options: webrtc.DisplayMediaStreamOptions = {
                video: {
                    width: { ideal: 2560 },
                    height: { ideal: 1440 },
                    frameRate: { ideal: 30, min: 15 }
                }
            };
            this.localStream = await mediaDevices.getDisplayMedia(options);
            const videoTracks = this.localStream.getVideoTracks();
            hilog.info(0x0000, TAG, 'Screen capture successful, tracks: ' + videoTracks.length);
            this.statusText = 'Screen capture ready, creating connection...';
            // Create PeerConnection — low latency config
            const pcConfig: webrtc.RTCConfiguration = {
                iceServers: ICE_SERVERS.iceServers,
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            };
            this.pc = this.factory.createPeerConnection(pcConfig);
            // Add video track — high bitrate low latency encoding
            for (const track of videoTracks) {
                const sender: webrtc.RTCRtpSender = this.pc.addTrack(track, this.localStream);
                const params: webrtc.RTCRtpSendParameters = sender.getParameters();
                if (params.encodings && params.encodings.length > 0) {
                    params.encodings[0].maxBitrate = 8000000; // 8 Mbps
                    params.encodings[0].maxFramerate = 30;
                    params.encodings[0].scaleResolutionDownBy = 1.0;
                    sender.setParameters(params);
                }
                hilog.info(0x0000, TAG, 'Added video track: ' + track.kind);
            }
            // ICE candidate event
            this.pc.onicecandidate = (event: webrtc.RTCPeerConnectionIceEvent) => {
                if (event.candidate) {
                    const iceMsg: IceCandidateMsg = {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    };
                    this.sendSignaling(iceMsg);
                }
            };
            // Connection state event
            this.pc.oniceconnectionstatechange = () => {
                if (this.pc) {
                    const state: string = this.pc.iceConnectionState;
                    console.info(TAG, 'ICE state:', state);
                    this.connectionState = state;
                    if (state === 'connected') {
                        this.isCasting = true;
                        this.statusText = 'Mirroring';
                    }
                    else if (state === 'disconnected' || state === 'failed') {
                        this.isCasting = false;
                        this.statusText = 'Disconnected';
                    }
                }
            };
            // Create Offer
            const offer: webrtc.RTCSessionDescriptionInit = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            const offerMsg: OfferMsg = {
                type: 'offer',
                sdp: offer.sdp as string
            };
            this.sendSignaling(offerMsg);
            this.statusText = 'Sent mirroring request, waiting for receiver response...';
        }
        catch (err) {
            const error = err as BusinessError;
            const msg: string = error.message || error.name || JSON.stringify(err);
            hilog.error(0x0000, TAG, 'Capture failed: ' + msg);
            this.statusText = 'Capture failed: ' + msg;
        }
    }
    /**
     * Start mirroring button
     */
    async startMirroring(): Promise<void> {
        try {
            this.statusText = 'Connecting to signaling server...';
            this.ws = await this.connectSignaling();
            this.ws.on('message', (err: BusinessError, value: string | ArrayBuffer) => {
                if (err) {
                    console.error(TAG, 'Message receiving error:', err.message);
                    return;
                }
                this.handleSignalingMessage(value as string);
            });
            this.ws.on('close', (_err: BusinessError) => {
                console.info(TAG, 'Signaling disconnected');
                this.statusText = 'Signaling disconnected';
                this.isCasting = false;
            });
            this.ws.on('error', (err: BusinessError) => {
                console.error(TAG, 'Signaling error:', err.message || JSON.stringify(err));
                this.statusText = `Connection failed: ${err.message || err.name || 'Unknown error'}`;
            });
        }
        catch (err) {
            const error = err as BusinessError;
            const msg: string = error.message || error.name || JSON.stringify(err);
            hilog.error(0x0000, TAG, 'Start failed: ' + msg);
            this.statusText = 'Start failed: ' + msg;
        }
    }
    /**
     * Stop mirroring
     */
    stopMirroring(): void {
        try {
            if (this.pc) {
                this.pc.close();
                this.pc = null;
            }
        }
        catch (_e) {
            // ignore
        }
        if (this.localStream) {
            const tracks = this.localStream.getVideoTracks();
            tracks.forEach(t => t.stop());
            this.localStream = null;
        }
        try {
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
        }
        catch (_e) {
            // ignore close errors
        }
        this.isCasting = false;
        this.statusText = 'Stopped';
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 20 });
            Column.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(400:5)", "entry");
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor({ "id": 16777227, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
            Column.justifyContent(FlexAlign.Center);
            Column.alignItems(HorizontalAlign.Center);
            Column.bindSheet({ value: this.showSettings, changeEvent: newValue => { this.showSettings = newValue; } }, { builder: () => {
                    this.settingsSheet.call(this);
                } }, {
                height: '50%',
                dragBar: true,
                onDisappear: () => {
                    this.showSettings = false;
                }
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // Header with title and settings icon
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(402:7)", "entry");
            // Header with title and settings icon
            Row.alignItems(VerticalAlign.Center);
            // Header with title and settings icon
            Row.margin({ top: 40 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('Screen Mirroring');
            Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(403:9)", "entry");
            Text.fontSize(28);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor({ "id": 16777230, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
        }, Text);
        Text.pop();
        // Header with title and settings icon
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            // Text(this.statusText)
            //   .fontSize(18)
            //   .fontColor(this.isCasting ? $r('app.color.success') : $r('app.color.warning'))
            //   .textAlign(TextAlign.Center)
            //   .width('80%')
            //   .padding(10)
            //   .backgroundColor($r('app.color.surface'))
            //   .borderRadius(8)
            if (!this.isCasting) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Button.createWithLabel('Start Mirroring');
                        Button.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(421:9)", "entry");
                        Button.fontSize(18);
                        Button.fontColor(Color.White);
                        Button.width('60%');
                        Button.height(48);
                        Button.backgroundColor({ "id": 16777225, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
                        Button.borderRadius(24);
                        Button.onClick(() => this.startMirroring());
                    }, Button);
                    Button.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Button.createWithLabel('Stop Mirroring');
                        Button.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(430:9)", "entry");
                        Button.fontSize(18);
                        Button.fontColor(Color.White);
                        Button.width('60%');
                        Button.height(48);
                        Button.backgroundColor({ "id": 16777226, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
                        Button.borderRadius(24);
                        Button.onClick(() => this.stopMirroring());
                    }, Button);
                    Button.pop();
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithChild({ type: ButtonType.Circle, stateEffect: true });
            Button.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(440:7)", "entry");
            Button.width(48);
            Button.height(48);
            Button.backgroundColor({ "id": 16777229, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
            Button.onClick(() => {
                this.settingsInput = this.signalingHost;
                this.showSettings = true;
            });
        }, Button);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125831493, "type": 40000, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
            SymbolGlyph.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(441:9)", "entry");
            SymbolGlyph.fontSize(22);
            SymbolGlyph.renderingStrategy(SymbolRenderingStrategy.SINGLE);
            SymbolGlyph.fontColor([{ "id": 125830976, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" }]);
        }, SymbolGlyph);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.statusText);
            Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(454:7)", "entry");
            Text.fontSize(11);
            Text.fontColor({ "id": 16777232, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
            Text.textAlign(TextAlign.Center);
            Text.margin({ bottom: 30 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.connectionState) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('ICE: ' + this.connectionState);
                        Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(461:9)", "entry");
                        Text.fontSize(12);
                        Text.fontColor({ "id": 16777231, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
                    }, Text);
                    Text.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.isCasting) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(467:9)", "entry");
                        Column.width('80%');
                        Column.height(160);
                        Column.backgroundColor({ "id": 16777229, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
                        Column.borderRadius(12);
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('Mobile screen mirroring in progress');
                        Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(468:11)", "entry");
                        Text.fontSize(14);
                        Text.fontColor({ "id": 16777228, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    /**
     * Settings Bottom Sheet
     */
    settingsSheet(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 16 });
            Column.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(497:5)", "entry");
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Center);
            Column.backgroundColor({ "id": 16777227, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // Header
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(499:7)", "entry");
            // Header
            Row.width('90%');
            // Header
            Row.justifyContent(FlexAlign.SpaceBetween);
            // Header
            Row.alignItems(VerticalAlign.Center);
            // Header
            Row.padding({ top: 16 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('Settings');
            Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(500:9)", "entry");
            Text.fontSize(20);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor({ "id": 16777230, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
            Blank.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(505:9)", "entry");
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel({ type: ButtonType.Circle, stateEffect: true });
            Button.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(507:9)", "entry");
            Button.width(40);
            Button.height(40);
            Button.backgroundColor(Color.Transparent);
            Button.onClick(() => {
                this.showSettings = false;
            });
        }, Button);
        Button.pop();
        // Header
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Divider.create();
            Divider.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(520:7)", "entry");
            Divider.width('90%');
        }, Divider);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // Signaling Server Input
            Column.create({ space: 8 });
            Column.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(524:7)", "entry");
            // Signaling Server Input
            Column.width('100%');
            // Signaling Server Input
            Column.alignItems(HorizontalAlign.Start);
            // Signaling Server Input
            Column.padding({ left: 16 });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('Signaling Server Address');
            Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(525:9)", "entry");
            Text.fontSize(14);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor({ "id": 16777230, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
            Text.width('90%');
            Text.textAlign(TextAlign.Start);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('Enter IP, hostname, or full WebSocket URL');
            Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(532:9)", "entry");
            Text.fontSize(12);
            Text.fontColor({ "id": 16777231, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
            Text.width('90%');
            Text.textAlign(TextAlign.Start);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            TextInput.create({ text: this.settingsInput, placeholder: 'e.g., 192.168.0.131' });
            TextInput.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(538:9)", "entry");
            TextInput.type(InputType.Normal);
            TextInput.fontSize(16);
            TextInput.fontColor({ "id": 16777230, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
            TextInput.width('90%');
            TextInput.height(48);
            TextInput.backgroundColor({ "id": 16777229, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
            TextInput.borderRadius(8);
            TextInput.padding({ left: 12, right: 12 });
            TextInput.onChange((value: string) => {
                this.settingsInput = value;
            });
        }, TextInput);
        // Signaling Server Input
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
            Blank.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(555:7)", "entry");
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // Action Buttons
            Row.create({ space: 12 });
            Row.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(558:7)", "entry");
            // Action Buttons
            Row.width('90%');
            // Action Buttons
            Row.justifyContent(FlexAlign.Center);
            // Action Buttons
            Row.padding({ bottom: 16 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('Cancel');
            Button.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(559:9)", "entry");
            Button.fontSize(16);
            Button.fontColor({ "id": 16777230, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
            Button.width('48%');
            Button.height(44);
            Button.backgroundColor({ "id": 16777229, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
            Button.borderRadius(8);
            Button.onClick(() => {
                this.showSettings = false;
            });
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('Save');
            Button.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(570:9)", "entry");
            Button.fontSize(16);
            Button.fontColor(Color.White);
            Button.width('48%');
            Button.height(44);
            Button.backgroundColor({ "id": 16777225, "type": 10001, params: [], "bundleName": "br.com.renanalencar.screenmirror", "moduleName": "entry" });
            Button.borderRadius(8);
            Button.onClick(() => {
                this.saveSettings();
                this.showSettings = false;
            });
        }, Button);
        Button.pop();
        // Action Buttons
        Row.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "ScreenMirror";
    }
}
registerNamedRoute(() => new ScreenMirror(undefined, {}), "", { bundleName: "br.com.renanalencar.screenmirror", moduleName: "entry", pagePath: "pages/ScreenMirror", pageFullPath: "entry/src/main/ets/pages/ScreenMirror", integratedHsp: "false", moduleType: "followWithHap" });
