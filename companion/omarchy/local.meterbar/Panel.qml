import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

// Workbench Meter for Omarchy. It renders only the sanitized local snapshot
// written by the browser extension's native host.
Panel {
  id: root
  moduleName: "local.meterbar"
  ipcTarget: "local.meterbar"
  manageIpc: false

  WorkbenchPalette { id: palette }

  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property color casing: palette.surface
  readonly property color casingRaised: palette.surface2
  readonly property color casingBorder: palette.border
  readonly property color enamel: palette.enamel
  readonly property color enamelInk: palette.enamelInk
  readonly property color muted: palette.muted
  readonly property color track: palette.track
  readonly property color ok: palette.ok
  readonly property color warn: palette.warn
  readonly property color crit: palette.crit
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property string monoFamily: "JetBrains Mono"

  property double nowMs: Date.now()
  readonly property real staleAfterMs: Math.max(1, Number(setting("staleAfterMinutes", 10))) * 60000
  readonly property var cards: usage.cards
  readonly property real peak: peakPercent()
  readonly property bool alarming: peak >= 90

  function alpha(color, amount) { return Qt.rgba(color.r, color.g, color.b, amount) }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)) }

  function rowFresh(row) {
    if (!row || row.stale === true || row.confidence === "unavailable") return false
    var captured = new Date(String(row.capturedAt || "")).getTime()
    return isFinite(captured) && nowMs - captured <= staleAfterMs
  }

  function rowsFor(card) {
    return card && card.snapshots ? card.snapshots : []
  }

  function freshRows(card) {
    var rows = rowsFor(card)
    var result = []
    for (var i = 0; i < rows.length; i++) if (rowFresh(rows[i])) result.push(rows[i])
    return result
  }

  function cardPeak(card) {
    var rows = freshRows(card)
    var value = -1
    for (var i = 0; i < rows.length; i++) value = Math.max(value, Number(rows[i].usedPercent))
    return value
  }

  function peakPercent() {
    var value = -1
    for (var i = 0; i < cards.length; i++) value = Math.max(value, cardPeak(cards[i]))
    return value
  }

  function peakCard() {
    var result = null
    var value = -1
    for (var i = 0; i < cards.length; i++) {
      var next = cardPeak(cards[i])
      if (next > value) { value = next; result = cards[i] }
    }
    return result
  }

  function peakRow() {
    var card = peakCard()
    var rows = freshRows(card)
    var result = null
    for (var i = 0; i < rows.length; i++)
      if (!result || Number(rows[i].usedPercent) > Number(result.usedPercent)) result = rows[i]
    return result
  }

  function riskColor(percent, fresh) {
    if (!fresh || percent < 0) return muted
    if (percent >= 90) return crit
    if (percent >= 70) return warn
    return ok
  }

  function windowLabel(row) {
    if (!row) return "Limit"
    if (String(row.workspaceLabel || "") !== "") return String(row.workspaceLabel)
    var labels = {
      five_hour: "5-hour limit",
      seven_day: "7-day limit",
      daily: "Daily limit",
      monthly: "Monthly limit",
      api_billing: "API billing",
      custom: "Usage limit"
    }
    return labels[String(row.window)] || "Usage limit"
  }

  function formatDuration(milliseconds) {
    if (!(milliseconds > 0)) return "now"
    var minutes = Math.floor(milliseconds / 60000)
    var hours = Math.floor(minutes / 60)
    var days = Math.floor(hours / 24)
    if (days > 0) return days + "d " + (hours % 24) + "h"
    if (hours > 0) return hours + "h " + (minutes % 60) + "m"
    return Math.max(1, minutes) + "m"
  }

  function resetText(row) {
    if (!row || !row.resetsAt) return "Reset unknown"
    var reset = new Date(String(row.resetsAt)).getTime()
    return isFinite(reset) ? "Resets in " + formatDuration(reset - nowMs) : "Reset unknown"
  }

  function confidenceText(row) {
    if (row && row.confidence === "estimated") return "Estimated"
    if (row && row.confidence === "inferred") return "Unofficial source"
    return ""
  }

  function rowMeta(row, fresh) {
    if (!fresh) return "Stale reading"
    var notes = []
    var confidence = confidenceText(row)
    if (confidence !== "") notes.push(confidence)
    notes.push(resetText(row))
    return notes.join(" · ")
  }

  function peakTooltip() {
    if (peak < 0) return "MeterBar · waiting for usage"
    var confidence = confidenceText(peakRow())
    return "MeterBar · " + Math.round(peak) + "% used" + (confidence !== "" ? " · " + confidence : "")
  }

  function updatedText() {
    if (!usage.generatedAt) return "Waiting for browser bridge"
    var generated = new Date(usage.generatedAt).getTime()
    if (!isFinite(generated)) return "Snapshot time unavailable"
    var age = Math.max(0, nowMs - generated)
    return (age > staleAfterMs ? "Snapshot stale · " : "Updated ") + formatDuration(age) + " ago"
  }

  function openExtension() {
    if (root.bar) root.bar.run("chromium --new-tab chrome-extension://gfihfehckcbnmklfojnhnindphonbhhp/src/popup/popup.html")
    root.close()
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onOpenedChanged: if (opened) {
    nowMs = Date.now()
    usage.reload()
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  Main {
    id: usage
    settings: root.settings
  }

  Timer {
    interval: 30000
    running: true
    repeat: true
    onTriggered: root.nowMs = Date.now()
  }

  IpcHandler {
    target: root.ipcTarget
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.toggle() }
    function reload(): string { usage.reload(); return "ok" }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    active: root.alarming
    tooltipText: root.peakTooltip()
    iconComponent: Component {
      Item {
        Row {
          anchors.centerIn: parent
          spacing: 2

          Repeater {
            model: root.cards.length > 0 ? root.cards : [{ provider: "claude" }, { provider: "chatgpt" }, { provider: "codex" }, { provider: "gemini" }]

            Rectangle {
              required property var modelData
              width: 4
              height: 17
              radius: 1
              color: root.track

              Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                height: parent.height * root.clamp(root.cardPeak(modelData) / 100, 0, 1)
                radius: 1
                color: root.riskColor(root.cardPeak(modelData), root.cardPeak(modelData) >= 0)
              }
            }
          }
        }
      }
    }
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.RightButton) root.openExtension()
      else root.toggle()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(390))
    contentHeight: panel.fittedContentHeight(content.implicitHeight, Style.space(660))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onActivateRequested: root.openExtension()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(text) { if (text === "r" || text === "R") usage.reload() }

      Flickable {
        id: flick
        anchors.fill: parent
        contentWidth: width
        contentHeight: content.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height
        ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }

        Column {
          id: content
          width: flick.width
          spacing: Style.space(10)

          Rectangle {
            width: parent.width
            height: Style.space(48)
            radius: Style.cornerRadius
            color: root.casingRaised
            border.width: 1
            border.color: root.casingBorder

            Row {
              anchors.left: parent.left
              anchors.leftMargin: Style.space(12)
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(10)

              Item {
                width: Style.space(28)
                height: Style.space(28)

                Rectangle {
                  anchors.fill: parent
                  radius: Style.space(6)
                  color: root.casing
                  border.width: 1
                  border.color: root.warn
                }

                Row {
                  anchors.centerIn: parent
                  spacing: 2
                  Repeater {
                    model: [8, 14, 11, 17]
                    Rectangle { required property var modelData; width: 2; height: modelData; color: root.warn }
                  }
                }
              }

              Column {
                spacing: Style.space(2)
                Text { text: "MeterBar"; color: root.enamel; font.family: root.fontFamily; font.pixelSize: Style.font.body; font.bold: true }
                Text { text: "LOCAL USAGE INSTRUMENT"; color: root.muted; font.family: root.monoFamily; font.pixelSize: Style.font.caption; font.letterSpacing: 1.1 }
              }
            }

            Row {
              anchors.right: parent.right
              anchors.rightMargin: Style.space(12)
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(6)
              Rectangle { width: Style.space(7); height: width; radius: width / 2; color: root.ok }
              Text { text: "LOCAL"; color: root.muted; font.family: root.monoFamily; font.pixelSize: Style.font.caption; font.letterSpacing: 1 }
            }
          }

          Rectangle {
            width: parent.width
            height: Style.space(126)
            radius: Style.cornerRadius
            color: root.enamel

            Column {
              anchors.left: parent.left
              anchors.leftMargin: Style.space(16)
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(6)

              Text { text: "MOST CONSTRAINED WINDOW"; color: palette.instrumentLabel; font.family: root.monoFamily; font.pixelSize: Style.font.caption; font.bold: true; font.letterSpacing: 1 }
              Row {
                spacing: Style.space(4)
                Text { text: root.peak >= 0 ? Math.round(root.peak) : "--"; color: root.enamelInk; font.family: root.monoFamily; font.pixelSize: Style.font.display; font.bold: true }
                Text { anchors.baseline: parent.children[0].baseline; text: "% used"; color: root.enamelInk; font.family: root.fontFamily; font.pixelSize: Style.font.caption; font.bold: true }
              }
              Text {
                width: Style.space(235)
                text: {
                  var card = root.peakCard()
                  var row = root.peakRow()
                  if (!card || !row) return "Waiting for a fresh provider reading."
                  var confidence = root.confidenceText(row)
                  return String(card.label || card.provider) + " · " + root.windowLabel(row)
                    + (confidence !== "" ? " · " + confidence : "")
                }
                color: palette.enamelCopy
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                elide: Text.ElideRight
              }
            }

            WorkbenchDial {
              anchors.right: parent.right
              anchors.rightMargin: Style.space(14)
              anchors.verticalCenter: parent.verticalCenter
              size: Style.space(88)
              percent: root.peak
              meterColor: root.riskColor(root.peak, root.peak >= 0)
            }
          }

          Rectangle {
            width: parent.width
            implicitHeight: providerBank.implicitHeight
            radius: Style.cornerRadius
            color: root.casing
            border.width: 1
            border.color: root.casingBorder

            Column {
              id: providerBank
              width: parent.width

              Repeater {
                model: root.cards

                Column {
                  id: providerDelegate
                  required property int index
                  readonly property var card: root.cards[index]
                  width: providerBank.width

                  Rectangle {
                    width: parent.width
                    height: Style.space(42)
                    color: "transparent"

                    Rectangle {
                      anchors.left: parent.left
                      anchors.leftMargin: Style.space(12)
                      anchors.verticalCenter: parent.verticalCenter
                      width: Style.space(7)
                      height: width
                      radius: width / 2
                      color: root.riskColor(root.cardPeak(providerDelegate.card), root.cardPeak(providerDelegate.card) >= 0)
                    }

                    Text {
                      anchors.left: parent.left
                      anchors.leftMargin: Style.space(29)
                      anchors.verticalCenter: parent.verticalCenter
                      text: String(providerDelegate.card.label || providerDelegate.card.provider)
                      color: root.enamel
                      font.family: root.fontFamily
                      font.pixelSize: Style.font.bodySmall
                      font.bold: true
                    }

                    Text {
                      anchors.right: parent.right
                      anchors.rightMargin: Style.space(12)
                      anchors.verticalCenter: parent.verticalCenter
                      text: root.rowsFor(providerDelegate.card).length > 0
                        ? root.rowsFor(providerDelegate.card).length + (root.rowsFor(providerDelegate.card).length === 1 ? " WINDOW" : " WINDOWS")
                        : String(providerDelegate.card.status || "IDLE").replace("_", " ").toUpperCase()
                      color: root.muted
                      font.family: root.monoFamily
                      font.pixelSize: Style.font.caption
                      font.letterSpacing: .8
                    }
                  }

                  Repeater {
                    model: root.rowsFor(providerDelegate.card)
                    MeterRow { required property var modelData; width: providerBank.width; row: modelData }
                  }

                  Item {
                    visible: root.rowsFor(providerDelegate.card).length === 0
                    width: parent.width
                    height: visible ? Style.space(48) : 0

                    Text {
                      anchors.left: parent.left
                      anchors.leftMargin: Style.space(29)
                      anchors.right: parent.right
                      anchors.rightMargin: Style.space(12)
                      anchors.verticalCenter: parent.verticalCenter
                      text: String(providerDelegate.card.message || (providerDelegate.card.status === "connected" ? "Connected · usage unavailable" : "No usage reported"))
                      color: root.muted
                      font.family: root.fontFamily
                      font.pixelSize: Style.font.caption
                      wrapMode: Text.WordWrap
                    }
                  }

                  Rectangle { width: parent.width; height: 1; color: root.casingBorder }
                }
              }
            }
          }

          Rectangle {
            visible: root.cards.length === 0 || usage.errorText !== ""
            width: parent.width
            implicitHeight: emptyText.implicitHeight + Style.space(26)
            radius: Style.cornerRadius
            color: root.casingRaised
            border.width: 1
            border.color: root.casingBorder

            Text {
              id: emptyText
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              anchors.margins: Style.space(13)
              text: usage.errorText !== "" ? usage.errorText : "Open the MeterBar extension once to publish a local snapshot."
              color: root.muted
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              wrapMode: Text.WordWrap
              horizontalAlignment: Text.AlignHCenter
            }
          }

          Row {
            width: parent.width
            spacing: Style.space(8)

            Text {
              width: parent.width - openButton.width - parent.spacing
              anchors.verticalCenter: parent.verticalCenter
              text: root.updatedText() + " · sanitized local snapshot"
              color: root.muted
              font.family: root.monoFamily
              font.pixelSize: Style.font.caption
              elide: Text.ElideRight
            }

            Button {
              id: openButton
              text: "Open MeterBar"
              bordered: true
              foreground: root.enamel
              fontFamily: root.fontFamily
              fontSize: Style.font.caption
              onClicked: root.openExtension()
            }
          }
        }
      }
    }
  }

  component WorkbenchDial: Canvas {
    id: dial
    property real size: 80
    property real percent: -1
    property color meterColor: root.muted
    width: size
    height: size
    onPercentChanged: requestPaint()
    onMeterColorChanged: requestPaint()
    onPaint: {
      var ctx = getContext("2d")
      ctx.reset()
      var center = width / 2
      var radius = width * .36
      var start = Math.PI * .83
      var sweep = Math.PI * 1.34
      ctx.lineWidth = Math.max(5, width * .12)
      ctx.lineCap = "butt"
      ctx.strokeStyle = palette.dialTrack
      ctx.beginPath()
      ctx.arc(center, center, radius, start, start + sweep)
      ctx.stroke()
      if (percent >= 0) {
        ctx.strokeStyle = meterColor
        ctx.beginPath()
        ctx.arc(center, center, radius, start, start + sweep * root.clamp(percent / 100, 0, 1))
        ctx.stroke()
      }
      var angle = start + sweep * root.clamp(Math.max(0, percent) / 100, 0, 1)
      ctx.strokeStyle = root.enamelInk
      ctx.lineWidth = Math.max(2, width * .035)
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.lineTo(center + Math.cos(angle) * radius * .82, center + Math.sin(angle) * radius * .82)
      ctx.stroke()
      ctx.fillStyle = root.enamelInk
      ctx.beginPath()
      ctx.arc(center, center, width * .085, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  component MeterRow: Item {
    id: meterRow
    property var row: null
    readonly property bool fresh: root.rowFresh(row)
    readonly property real percent: row ? Number(row.usedPercent) : -1
    readonly property color levelColor: root.riskColor(percent, fresh)

    height: Style.space(58)

    Column {
      anchors.left: parent.left
      anchors.leftMargin: Style.space(29)
      anchors.verticalCenter: parent.verticalCenter
      width: Style.space(105)
      spacing: Style.space(3)
      Text { width: parent.width; text: root.windowLabel(meterRow.row); color: root.enamel; font.family: root.fontFamily; font.pixelSize: Style.font.caption; elide: Text.ElideRight }
      Text { width: parent.width; text: root.rowMeta(meterRow.row, meterRow.fresh); color: root.muted; font.family: root.monoFamily; font.pixelSize: Style.font.caption; elide: Text.ElideRight }
    }

    Rectangle {
      id: meterTrack
      anchors.left: parent.left
      anchors.leftMargin: Style.space(145)
      anchors.right: meterValue.left
      anchors.rightMargin: Style.space(10)
      anchors.verticalCenter: parent.verticalCenter
      height: Style.space(7)
      color: root.track
      border.width: 1
      border.color: root.casingBorder

      Rectangle {
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: parent.width * root.clamp(meterRow.percent / 100, 0, 1)
        color: meterRow.levelColor
        Behavior on width { NumberAnimation { duration: 180; easing.type: Easing.OutCubic } }
      }
    }

    Text {
      id: meterValue
      anchors.right: parent.right
      anchors.rightMargin: Style.space(12)
      anchors.verticalCenter: parent.verticalCenter
      width: Style.space(44)
      text: meterRow.percent >= 0 ? Math.round(meterRow.percent) + "%" : "-"
      color: meterRow.levelColor
      font.family: root.monoFamily
      font.pixelSize: Style.font.body
      font.bold: true
      horizontalAlignment: Text.AlignRight
    }
  }
}
