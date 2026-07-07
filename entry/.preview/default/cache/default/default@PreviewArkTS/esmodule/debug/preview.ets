struct preview{build(){Column({ space: 20 }) {
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
    })}}