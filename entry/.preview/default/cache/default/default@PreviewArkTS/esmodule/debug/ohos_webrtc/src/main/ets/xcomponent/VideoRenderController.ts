import { NativeVideoRenderer } from "@app:com.example.screenmirror/entry/ohos_webrtc";
import type { MediaStreamTrack } from "@app:com.example.screenmirror/entry/ohos_webrtc";
import { Logging } from "@bundle:com.example.screenmirror/entry@ohos_webrtc/ets/log/Logging";
const TAG: string = '[XComponentController1]';
export enum ScalingMode {
    Fill = 0,
    AspectFill = 1,
    AspectFit = 2
}
export class VideoRenderController extends XComponentController {
    private renderer: NativeVideoRenderer = new NativeVideoRenderer();
    setVideoTrack(track: MediaStreamTrack | null): void {
        this.renderer.setVideoTrack(track);
    }
    setMirror(mirror: boolean): void {
        this.renderer.setMirror(mirror);
    }
    setMirrorVertically(mirrorVertically: boolean): void {
        this.renderer.setMirrorVertically(mirrorVertically);
    }
    setScalingMode(mode: ScalingMode): void {
        this.renderer.setScalingMode(mode);
    }
    onSurfaceCreated(surfaceId: string): void {
        Logging.d(TAG, 'onSurfaceCreated surfaceId: ' + surfaceId);
        this.renderer.init(surfaceId);
    }
    onSurfaceChanged(surfaceId: string, rect: SurfaceRect): void {
        Logging.d(TAG, 'onSurfaceChanged surfaceId: ' + surfaceId);
        Logging.d(TAG, 'onSurfaceChanged rect: ' + rect);
    }
    onSurfaceDestroyed(surfaceId: string): void {
        Logging.d(TAG, 'onSurfaceDestroyed surfaceId: ' + surfaceId);
        this.renderer.release();
    }
}
