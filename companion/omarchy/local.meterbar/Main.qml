import QtQuick
import Quickshell
import Quickshell.Io

// Display-only data model. The browser extension sanitizes state, and the native
// host writes this one local JSON file. No provider endpoint or credential is read here.
Item {
  id: root
  visible: false

  property var settings: ({})
  readonly property string home: Quickshell.env("HOME") || ""
  readonly property string stateHome: Quickshell.env("XDG_STATE_HOME") || home + "/.local/state"
  readonly property string statePath: expandPath(setting("statePath", "")) || stateHome + "/meterbar/state.json"

  property var snapshot: ({ schemaVersion: 1, generatedAt: "", cards: [] })
  property int revision: 0
  property string errorText: ""

  readonly property var cards: {
    var changed = revision
    var rows = snapshot && Array.isArray(snapshot.cards) ? snapshot.cards.slice() : []
    var order = { claude: 0, chatgpt: 1, codex: 2, gemini: 3 }
    rows.sort(function(a, b) {
      var left = order[String(a.provider)]
      var right = order[String(b.provider)]
      return Number(left === undefined ? 99 : left) - Number(right === undefined ? 99 : right)
    })
    return rows
  }

  readonly property string generatedAt: snapshot && snapshot.generatedAt ? String(snapshot.generatedAt) : ""

  FileView {
    id: stateFile
    path: root.statePath
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.parse(text())
    onLoadFailed: {
      root.errorText = "Waiting for the MeterBar browser bridge."
      root.snapshot = ({ schemaVersion: 1, generatedAt: "", cards: [] })
      root.revision++
    }
  }

  function setting(name, fallback) {
    var value = settings ? settings[name] : undefined
    return value === undefined || value === null ? fallback : value
  }

  function expandPath(raw) {
    var value = String(raw || "").trim()
    if (value === "") return ""
    if (value === "~") return home
    if (value.indexOf("~/") === 0) return home + value.substring(1)
    if (value.indexOf("$HOME/") === 0) return home + value.substring(5)
    if (value.charAt(0) !== "/") return home + "/" + value
    return value
  }

  function parse(content) {
    try {
      var value = JSON.parse(String(content || ""))
      if (!value || value.schemaVersion !== 1 || !Array.isArray(value.cards)) throw new Error("bad schema")
      snapshot = value
      errorText = ""
      revision++
    } catch (error) {
      errorText = "MeterBar snapshot could not be read."
      snapshot = ({ schemaVersion: 1, generatedAt: "", cards: [] })
      revision++
    }
  }

  function reload() { stateFile.reload() }
}
