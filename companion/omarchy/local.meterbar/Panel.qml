import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

// MeterBar glass dashboard for Omarchy. It renders only the sanitized local snapshot
// written by the browser extension's native host: no provider request, no credential.
Panel {
  id: root
  moduleName: "local.meterbar"
  ipcTarget: "local.meterbar"
  manageIpc: false

  WorkbenchPalette { id: palette }

  // The shell paints the panel with the theme's popup color; pick the palette that reads on it.
  readonly property color panelBackground: Color.popups.background
  readonly property bool lightTheme: (panelBackground.r * 0.299 + panelBackground.g * 0.587 + panelBackground.b * 0.114) > 0.6
  readonly property var tone: lightTheme ? palette.light : palette.dark
  readonly property color text: tone.text
  readonly property color muted: tone.muted
  readonly property color number: tone.number
  readonly property color accent: tone.accent
  readonly property color ok: tone.ok
  readonly property color warn: tone.warn
  readonly property color crit: tone.crit
  readonly property color hairline: alpha(tone.line, 0.14)
  readonly property color hairlineSoft: alpha(tone.line, 0.10)
  readonly property color track: alpha(tone.sunken, 0.44)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  property double nowMs: Date.now()
  readonly property real staleAfterMs: Math.max(1, Number(setting("staleAfterMinutes", 10))) * 60000
  readonly property var cards: usage.cards
  readonly property real peak: peakPercent()
  readonly property bool alarming: peak >= 90
  readonly property real dayMs: 24 * 60 * 60 * 1000

  function alpha(color, amount) { var c = Qt.color(color); return Qt.rgba(c.r, c.g, c.b, amount) }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)) }

  function rowFresh(row) {
    if (!row || row.stale === true || row.confidence === "unavailable") return false
    var captured = new Date(String(row.capturedAt || "")).getTime()
    return isFinite(captured) && nowMs - captured <= staleAfterMs
  }

  function rowsFor(card) { return card && card.snapshots ? card.snapshots : [] }

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
    var rows = freshRows(peakCard())
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

  function seriesColor(provider) {
    if (provider === "claude") return tone.seriesClaude
    if (provider === "codex") return tone.seriesCodex
    return tone.seriesOpenai
  }

  function windowLabel(row) {
    if (!row) return "Limit"
    if (String(row.workspaceLabel || "") !== "") return String(row.workspaceLabel)
    var labels = { five_hour: "5-hour", seven_day: "Weekly", daily: "Daily", monthly: "Monthly", api_billing: "API billing", custom: "Usage" }
    return labels[String(row.window)] || "Usage"
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

  // One short word in rows and the hero; the tooltip keeps the full phrase.
  function shortConfidence(row) {
    if (row && row.confidence === "estimated") return "estimated"
    if (row && row.confidence === "inferred") return "inferred"
    return ""
  }

  function rowMeta(row, fresh) {
    var notes = [resetText(row)]
    if (!fresh) notes.push("stale")
    var confidence = shortConfidence(row)
    if (confidence !== "") notes.push(confidence)
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

  function historyFor(card) {
    return card && Array.isArray(card.history) && card.history.length >= 2 ? card.history : []
  }

  function trendCards() {
    var result = []
    for (var i = 0; i < cards.length; i++) if (historyFor(cards[i]).length > 0) result.push(cards[i])
    return result
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

  // Bar widget: four fixed provider slots as mini meters, plus the tightest percent.
  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    active: root.alarming
    tooltipText: root.peakTooltip()
    // Four pills plus a percent need a wide slot, like the power widget with its percentage.
    slotSize: Style.bar.iconSlot * 2.9
    opticalSize: slotSize
    iconComponent: Component {
      Item {
        implicitWidth: widgetRow.implicitWidth + Style.space(10)
        implicitHeight: widgetRow.implicitHeight

        Row {
          id: widgetRow
          anchors.centerIn: parent
          spacing: Style.space(5)

          Row {
            anchors.verticalCenter: parent.verticalCenter
            spacing: 2

            Repeater {
              model: root.cards.length > 0 ? root.cards : [{ provider: "claude" }, { provider: "chatgpt" }, { provider: "codex" }, { provider: "gemini" }]

              Rectangle {
                required property var modelData
                readonly property real percent: root.cardPeak(modelData)
                width: 12
                height: 4
                radius: 2
                color: root.track

                Rectangle {
                  anchors.left: parent.left
                  anchors.top: parent.top
                  anchors.bottom: parent.bottom
                  width: parent.width * root.clamp(parent.percent / 100, 0, 1)
                  radius: 2
                  color: root.riskColor(parent.percent, parent.percent >= 0)
                }
              }
            }
          }

          Text {
            anchors.verticalCenter: parent.verticalCenter
            text: root.peak >= 0 ? Math.round(root.peak) + "%" : "--"
            // Risk lives in the pills; the number keeps the bar's own foreground so it stays legible on any theme.
            color: root.bar ? root.bar.foreground : root.text
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: true
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
    contentWidth: panel.fittedContentWidth(Style.space(380))
    contentHeight: panel.fittedContentHeight(content.implicitHeight, Style.space(640))

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
          spacing: Style.space(8)

          // Header: mark + risk dot, updated stamp
          Item {
            width: parent.width
            height: Style.space(22)

            Row {
              anchors.left: parent.left
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(6)
              Text { text: "MeterBar"; color: root.text; font.family: root.fontFamily; font.pixelSize: Style.font.body; font.bold: true }
              Rectangle { anchors.verticalCenter: parent.verticalCenter; width: 6; height: 6; radius: 3; color: root.riskColor(root.peak, root.peak >= 0) }
            }

            Text {
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              text: root.updatedText() + " · local file"
              color: root.muted
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
            }
          }

          // Hero: tightest limit
          Column {
            width: parent.width
            spacing: Style.space(5)

            Text { text: "TIGHTEST LIMIT"; color: root.muted; font.family: root.fontFamily; font.pixelSize: Style.font.caption; font.letterSpacing: 1 }
            Row {
              spacing: Style.space(2)
              Text {
                id: heroValue
                text: root.peak >= 0 ? Math.round(root.peak) : "--"
                color: root.peak >= 0 ? root.riskColor(root.peak, true) : root.muted
                font.family: root.fontFamily
                font.pixelSize: Style.font.display
                font.bold: true
              }
              Text { anchors.baseline: heroValue.baseline; text: "% used"; color: root.muted; font.family: root.fontFamily; font.pixelSize: Style.font.body }
            }
            Text {
              width: parent.width
              text: {
                var card = root.peakCard()
                var row = root.peakRow()
                if (!card || !row) return usage.errorText !== "" ? usage.errorText : "No live limit yet - waiting for a fresh reading from the browser extension."
                return String(card.label || card.provider) + " " + root.windowLabel(row) + " · " + root.rowMeta(row, true)
              }
              color: root.muted
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              wrapMode: Text.WordWrap
            }
          }

          Rectangle { width: parent.width; height: 1; color: root.hairlineSoft }

          // Trend: 24h, one line per provider with history
          Column {
            width: parent.width
            spacing: Style.space(6)

            Item {
              width: parent.width
              height: Style.space(14)
              Text { anchors.left: parent.left; text: "TREND"; color: root.text; font.family: root.fontFamily; font.pixelSize: Style.font.caption; font.bold: true; font.letterSpacing: 1 }
              Text { anchors.right: parent.right; text: "24 h · % of limit used"; color: root.muted; font.family: root.fontFamily; font.pixelSize: Style.font.caption }
            }

            Canvas {
              id: trend
              width: parent.width
              height: Style.space(104)
              visible: root.trendCards().length > 0

              Connections {
                target: usage
                function onRevisionChanged() { trend.requestPaint() }
              }
              onWidthChanged: requestPaint()
              Component.onCompleted: requestPaint()

              onPaint: {
                var ctx = getContext("2d")
                ctx.reset()
                var left = Style.space(22), right = width - Style.space(22), top = Style.space(6), bottom = height - Style.space(12)
                var from = root.nowMs - root.dayMs, to = root.nowMs
                function x(t) { return left + (t - from) / (to - from) * (right - left) }
                function y(p) { return bottom - root.clamp(p, 0, 100) / 100 * (bottom - top) }

                ctx.font = Style.font.caption * 0.85 + "px " + root.fontFamily
                ctx.lineWidth = 1
                var grid = [0, 50, 100]
                for (var g = 0; g < grid.length; g++) {
                  ctx.strokeStyle = root.hairlineSoft
                  ctx.beginPath(); ctx.moveTo(left, y(grid[g])); ctx.lineTo(right, y(grid[g])); ctx.stroke()
                  ctx.fillStyle = root.muted
                  ctx.textAlign = "right"
                  ctx.fillText(String(grid[g]), left - 6, y(grid[g]) + 3)
                }
                ctx.setLineDash([2, 3])
                ctx.strokeStyle = root.alpha(root.warn, 0.4); ctx.beginPath(); ctx.moveTo(left, y(70)); ctx.lineTo(right, y(70)); ctx.stroke()
                ctx.strokeStyle = root.alpha(root.crit, 0.45); ctx.beginPath(); ctx.moveTo(left, y(90)); ctx.lineTo(right, y(90)); ctx.stroke()
                ctx.setLineDash([])

                var series = root.trendCards()
                ctx.lineWidth = 2
                ctx.lineJoin = "round"
                ctx.lineCap = "round"
                for (var s = 0; s < series.length; s++) {
                  var points = root.historyFor(series[s])
                  var color = root.seriesColor(series[s].provider)
                  ctx.strokeStyle = color
                  ctx.beginPath()
                  var drawn = 0
                  for (var i = 0; i < points.length; i++) {
                    var t = Number(points[i][0]), p = Number(points[i][1])
                    if (!(t >= from && t <= to)) continue
                    if (drawn === 0) ctx.moveTo(x(t), y(p)); else ctx.lineTo(x(t), y(p))
                    drawn++
                  }
                  ctx.stroke()
                  if (drawn > 0) {
                    var last = points[points.length - 1]
                    var lx = x(Number(last[0])), ly = y(Number(last[1]))
                    ctx.fillStyle = color
                    ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill()
                    ctx.fillStyle = root.text
                    ctx.textAlign = "left"
                    ctx.fillText(String(Math.round(Number(last[1]))), lx + 7, ly + 3)
                  }
                }

                ctx.fillStyle = root.muted
                ctx.textAlign = "left"; ctx.fillText("-24h", left, height - 2)
                ctx.textAlign = "center"; ctx.fillText("-12h", (left + right) / 2, height - 2)
                ctx.textAlign = "right"; ctx.fillText("now", right, height - 2)
              }
            }

            Text {
              visible: root.trendCards().length === 0
              width: parent.width
              text: "The trend appears after a few readings - the extension records one every 10 minutes."
              color: root.muted
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              wrapMode: Text.WordWrap
            }

            Row {
              visible: root.trendCards().length > 0
              spacing: Style.space(12)
              Repeater {
                model: root.trendCards()
                Row {
                  required property var modelData
                  spacing: Style.space(5)
                  Rectangle { anchors.verticalCenter: parent.verticalCenter; width: 10; height: 2; radius: 1; color: root.seriesColor(modelData.provider) }
                  Text { text: String(modelData.label || modelData.provider); color: root.muted; font.family: root.fontFamily; font.pixelSize: Style.font.caption }
                }
              }
            }
          }

          Rectangle { width: parent.width; height: 1; color: root.hairlineSoft }

          // Limits: compact rows in fixed provider order
          Column {
            width: parent.width
            spacing: Style.space(7)

            Text { text: "LIMITS"; color: root.text; font.family: root.fontFamily; font.pixelSize: Style.font.caption; font.bold: true; font.letterSpacing: 1 }

            Repeater {
              model: root.cards

              Item {
                id: limitRow
                required property int index
                readonly property var card: root.cards[index]
                readonly property var rows: root.rowsFor(card)
                width: parent.width
                height: Math.max(nameText.implicitHeight, windowsColumn.implicitHeight)

                Row {
                  id: nameText
                  anchors.left: parent.left
                  anchors.top: parent.top
                  width: Style.space(74)
                  spacing: Style.space(6)
                  ProviderMark { anchors.verticalCenter: parent.verticalCenter; provider: String(limitRow.card.provider); color: root.text }
                  Text {
                    width: parent.width - Style.space(18)
                    text: String(limitRow.card.label || limitRow.card.provider)
                    color: root.text
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.bodySmall
                    font.bold: true
                    elide: Text.ElideRight
                  }
                }

                Column {
                  id: windowsColumn
                  anchors.left: parent.left
                  anchors.leftMargin: Style.space(86)
                  anchors.right: parent.right
                  anchors.top: parent.top
                  spacing: Style.space(3)

                  Repeater {
                    model: limitRow.rows
                    Column {
                      id: windowDelegate
                      required property var modelData
                      readonly property bool fresh: root.rowFresh(modelData)
                      readonly property real percent: Number(modelData.usedPercent)
                      width: windowsColumn.width
                      spacing: Style.space(2)

                      Item {
                        width: parent.width
                        height: Style.space(14)
                        Text { anchors.left: parent.left; text: root.windowLabel(windowDelegate.modelData); color: root.muted; font.family: root.fontFamily; font.pixelSize: Style.font.caption }
                        Text {
                          anchors.right: parent.right
                          text: (windowDelegate.percent >= 0 ? Math.round(windowDelegate.percent) : "--") + "% used"
                          color: windowDelegate.fresh ? (windowDelegate.percent >= 70 ? root.riskColor(windowDelegate.percent, true) : root.text) : root.muted
                          font.family: root.fontFamily
                          font.pixelSize: Style.font.caption
                        }
                      }
                      Text {
                        width: parent.width
                        text: root.rowMeta(windowDelegate.modelData, windowDelegate.fresh)
                        color: root.muted
                        font.family: root.fontFamily
                        font.pixelSize: Style.font.caption
                        elide: Text.ElideRight
                      }
                    }
                  }

                  Item {
                    visible: limitRow.rows.length === 0
                    width: parent.width
                    height: visible ? Style.space(14) : 0
                    Text {
                      anchors.left: parent.left
                      text: limitRow.card.provider === "gemini" ? "Status only" : "No usage"
                      color: root.muted
                      font.family: root.fontFamily
                      font.pixelSize: Style.font.caption
                    }
                    Text {
                      anchors.right: parent.right
                      text: limitRow.card.status === "connected" ? "Signed in" : String(limitRow.card.message || "Not connected")
                      color: limitRow.card.status === "connected" ? root.accent : root.muted
                      font.family: root.fontFamily
                      font.pixelSize: Style.font.caption
                      elide: Text.ElideLeft
                      width: Math.min(implicitWidth, parent.width - Style.space(80))
                    }
                  }
                }
              }
            }
          }

          Rectangle { width: parent.width; height: 1; color: root.hairlineSoft }

          Row {
            width: parent.width
            spacing: Style.space(8)

            Text {
              width: parent.width - openButton.width - parent.spacing
              anchors.verticalCenter: parent.verticalCenter
              text: "Sanitized local snapshot"
              color: root.muted
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              elide: Text.ElideRight
            }

            Button {
              id: openButton
              text: "Open MeterBar"
              bordered: true
              foreground: root.text
              fontFamily: root.fontFamily
              fontSize: Style.font.caption
              onClicked: root.openExtension()
            }
          }
        }
      }
    }
  }

  // The same single-weight marks the popup draws (16-unit paths), so position and glyph agree across surfaces.
  component ProviderMark: Canvas {
    id: mark
    property string provider: "claude"
    property color color: root.text
    width: 12
    height: 12
    onProviderChanged: requestPaint()
    onColorChanged: requestPaint()
    Component.onCompleted: requestPaint()
    onPaint: {
      var ctx = getContext("2d")
      ctx.reset()
      var k = width / 16
      ctx.strokeStyle = mark.color
      ctx.lineWidth = 1.6
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      if (mark.provider === "claude") {
        ctx.moveTo(8 * k, 1.5 * k); ctx.lineTo(8 * k, 14.5 * k)
        ctx.moveTo(1.5 * k, 8 * k); ctx.lineTo(14.5 * k, 8 * k)
        ctx.moveTo(3.4 * k, 3.4 * k); ctx.lineTo(12.6 * k, 12.6 * k)
        ctx.moveTo(12.6 * k, 3.4 * k); ctx.lineTo(3.4 * k, 12.6 * k)
      } else if (mark.provider === "codex") {
        ctx.roundedRect(2 * k, 2 * k, 12 * k, 12 * k, 3 * k, 3 * k)
        ctx.moveTo(6 * k, 6 * k); ctx.lineTo(4 * k, 8 * k); ctx.lineTo(6 * k, 10 * k)
        ctx.moveTo(10 * k, 6 * k); ctx.lineTo(12 * k, 8 * k); ctx.lineTo(10 * k, 10 * k)
      } else if (mark.provider === "gemini") {
        ctx.moveTo(8 * k, 1.5 * k)
        ctx.bezierCurveTo(8 * k, 5.5 * k, 10.5 * k, 8 * k, 14.5 * k, 8 * k)
        ctx.bezierCurveTo(10.5 * k, 8 * k, 8 * k, 10.5 * k, 8 * k, 14.5 * k)
        ctx.bezierCurveTo(8 * k, 10.5 * k, 5.5 * k, 8 * k, 1.5 * k, 8 * k)
        ctx.bezierCurveTo(5.5 * k, 8 * k, 8 * k, 5.5 * k, 8 * k, 1.5 * k)
      } else {
        ctx.arc(8 * k, 8 * k, 6 * k, 0, Math.PI * 2)
        var spokes = [[8, 2, 8, 5.2], [8, 10.8, 8, 14], [2.8, 5, 5.6, 6.6], [10.4, 9.4, 13.2, 11], [2.8, 11, 5.6, 9.4], [10.4, 6.6, 13.2, 5]]
        for (var i = 0; i < spokes.length; i++) {
          ctx.moveTo(spokes[i][0] * k, spokes[i][1] * k); ctx.lineTo(spokes[i][2] * k, spokes[i][3] * k)
        }
      }
      ctx.stroke()
    }
  }
}
