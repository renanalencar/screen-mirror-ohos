import type AbilityConstant from "@ohos:app.ability.AbilityConstant";
import hilog from "@ohos:hilog";
import UIAbility from "@ohos:app.ability.UIAbility";
import type Want from "@ohos:app.ability.Want";
import type window from "@ohos:window";
export default class EntryAbility extends UIAbility {
    onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
        hilog.info(0x0000, 'ScreenMirror', 'Ability onCreate');
    }
    onDestroy(): void {
        hilog.info(0x0000, 'ScreenMirror', 'Ability onDestroy');
    }
    onWindowStageCreate(windowStage: window.WindowStage): void {
        hilog.info(0x0000, 'ScreenMirror', 'Ability onWindowStageCreate');
        windowStage.loadContent('pages/ScreenMirror', (err) => {
            if (err.code) {
                hilog.error(0x0000, 'ScreenMirror', 'Failed to load content: %{public}s', JSON.stringify(err));
                return;
            }
            hilog.info(0x0000, 'ScreenMirror', 'Succeeded in loading content');
        });
    }
    onWindowStageDestroy(): void {
        hilog.info(0x0000, 'ScreenMirror', 'Ability onWindowStageDestroy');
    }
}
