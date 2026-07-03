if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface ScreenMirror_Params {
    statusText?: string;
    isCasting?: boolean;
    connectionState?: string;
    factory?: webrtc.PeerConnectionFactory | null;
    pc?: webrtc.RTCPeerConnection | null;
    ws?: webSocket.WebSocket | null;
    localStream?: webrtc.MediaStream | null;
}
import webrtc from "@bundle:com.example.screenmirror/entry@ohos_webrtc/Index";
import webSocket from "@ohos:net.webSocket";
import type { BusinessError } from "@ohos:base";
import hilog from "@ohos:hilog";
const TAG = 'ScreenMirror';
// ====== Replace with your PC's local IP (192.168.x.x) ======
const SIGNALING_URL = 'ws://[IP_ADDRESS]';
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
        this.factory = null;
        this.pc = null;
        this.ws = null;
        this.localStream = null;
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
    }
    updateStateVars(params: ScreenMirror_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__statusText.purgeDependencyOnElmtId(rmElmtId);
        this.__isCasting.purgeDependencyOnElmtId(rmElmtId);
        this.__connectionState.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__statusText.aboutToBeDeleted();
        this.__isCasting.aboutToBeDeleted();
        this.__connectionState.aboutToBeDeleted();
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
    private factory: webrtc.PeerConnectionFactory | null;
    private pc: webrtc.RTCPeerConnection | null;
    private ws: webSocket.WebSocket | null;
    private localStream: webrtc.MediaStream | null;
    aboutToAppear(): void {
        hilog.info(0x0000, TAG, 'Page initialized');
    }
    /**
     * Establish WebSocket signaling connection
     */
    async connectSignaling(): Promise<webSocket.WebSocket> {
        return new Promise((resolve, reject) => {
            const ws = webSocket.createWebSocket();
            ws.connect(SIGNALING_URL, (err: BusinessError, value: boolean) => {
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
                console.error(TAG, 'Signaling error:', err.message);
                this.statusText = `Connection failed: ${err.message}`;
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
            Column.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(282:5)", "entry");
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor('#1a1a2e');
            Column.justifyContent(FlexAlign.Center);
            Column.alignItems(HorizontalAlign.Center);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('Screen Mirroring');
            Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(283:7)", "entry");
            Text.fontSize(28);
            Text.fontWeight(FontWeight.Bold);
            Text.margin({ top: 40 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.statusText);
            Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(288:7)", "entry");
            Text.fontSize(18);
            Text.fontColor(this.isCasting ? '#53d769' : '#ffc107');
            Text.textAlign(TextAlign.Center);
            Text.width('80%');
            Text.padding(10);
            Text.backgroundColor('#16213e');
            Text.borderRadius(8);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.connectionState) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('ICE: ' + this.connectionState);
                        Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(298:9)", "entry");
                        Text.fontSize(12);
                        Text.fontColor('#888');
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
                        Column.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(304:9)", "entry");
                        Column.width('80%');
                        Column.height(160);
                        Column.backgroundColor('#16213e');
                        Column.borderRadius(12);
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('Mobile screen mirroring in progress');
                        Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(305:11)", "entry");
                        Text.fontSize(14);
                        Text.fontColor('#53d769');
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
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (!this.isCasting) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Button.createWithLabel('Start Mirroring');
                        Button.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(317:9)", "entry");
                        Button.fontSize(18);
                        Button.width('60%');
                        Button.height(48);
                        Button.backgroundColor('#0f3460');
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
                        Button.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(325:9)", "entry");
                        Button.fontSize(18);
                        Button.width('60%');
                        Button.height(48);
                        Button.backgroundColor('#c0392b');
                        Button.borderRadius(24);
                        Button.onClick(() => this.stopMirroring());
                    }, Button);
                    Button.pop();
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('Signaling Server: ' + SIGNALING_URL);
            Text.debugLine("entry/src/main/ets/pages/ScreenMirror.ets(334:7)", "entry");
            Text.fontSize(11);
            Text.fontColor('#666');
            Text.textAlign(TextAlign.Center);
            Text.margin({ bottom: 30 });
        }, Text);
        Text.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "ScreenMirror";
    }
}
registerNamedRoute(() => new ScreenMirror(undefined, {}), "", { bundleName: "com.example.screenmirror", moduleName: "entry", pagePath: "pages/ScreenMirror", pageFullPath: "entry/src/main/ets/pages/ScreenMirror", integratedHsp: "false", moduleType: "followWithHap" });
