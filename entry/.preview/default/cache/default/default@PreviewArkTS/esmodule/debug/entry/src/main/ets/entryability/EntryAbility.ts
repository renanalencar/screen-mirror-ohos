import type AbilityConstant from "@ohos:app.ability.AbilityConstant";
import ConfigurationConstant from "@ohos:app.ability.ConfigurationConstant";
import hilog from "@ohos:hilog";
import UIAbility from "@ohos:app.ability.UIAbility";
import type Want from "@ohos:app.ability.Want";
import type window from "@ohos:window";
export default class EntryAbility extends UIAbility {
    onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
        hilog.info(0x0000, 'ScreenMirror', 'Ability onCreate');
        // Follow the device's system color theme (light/dark). With NOT_SET the
        // system picks the matching resource qualifier (base vs. dark) automatically.
        this.context.getApplicationContext()
            .setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET);
    }
    onDestroy(): void {
        hilog.info(0x0000, 'ScreenMirror', 'Ability onDestroy');
    }
    onWindowStageCreate(windowStage: window.WindowStage): void {
        hilog.info(0x0000, 'ScreenMirror', 'Ability onWindowStageCreate');
        // Store context in AppStorage for preferences access
        AppStorage.setOrCreate('context', this.context);
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
