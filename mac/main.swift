import AppKit
import WebKit

// The Mac app: one window with a WKWebView that runs the shared UI (src/mac/main.ts) and answers its
// file requests from the folder the user picked (Workspace.swift).

// The last folder, remembered as a plain path: the app is not sandboxed, so it needs no
// security-scoped bookmark. `-folder <path>` on the command line overrides it for one launch.
let folderKey = "folder"
let appOrigin = "outliner://app/"

// Serves the built page from Resources/web at outliner://app/, so it needs neither file:// access
// nor a local HTTP server.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
  private let webRoot = Bundle.main.resourceURL!.appendingPathComponent("web").standardized
  private let contentTypes = [
    "html": "text/html", "js": "text/javascript", "css": "text/css", "svg": "image/svg+xml", "json": "application/json",
  ]

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    let path = task.request.url!.path
    let file = webRoot.appendingPathComponent(path == "/" ? "index.html" : path).standardized
    guard file.path.hasPrefix(webRoot.path + "/"), let type = contentTypes[file.pathExtension],
      let data = FileManager.default.contents(atPath: file.path)
    else {
      task.didFailWithError(URLError(.fileDoesNotExist))
      return
    }
    task.didReceive(HTTPURLResponse(
      url: task.request.url!, statusCode: 200, httpVersion: nil,
      headerFields: ["Content-Type": type + "; charset=utf-8", "Content-Length": String(data.count)])!)
    task.didReceive(data)
    task.didFinish()
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

// Answers window.webkit.messageHandlers.outliner.postMessage(...) from src/mac/adapter.ts. A failure
// replies with an error code from `server` in src/ui/messages.ts, which rejects the page's promise.
final class FileMessageHandler: NSObject, WKScriptMessageHandlerWithReply {
  var workspace: Workspace?

  func userContentController(
    _ controller: WKUserContentController, didReceive message: WKScriptMessage,
    replyHandler: @escaping (Any?, String?) -> Void
  ) {
    do { replyHandler(try handle(message.body as? [String: Any] ?? [:]), nil) }
    catch let error as WorkspaceError { replyHandler(nil, error.code) }
    catch {
      NSLog("Markdown Outliner: %@", String(describing: error))
      replyHandler(nil, "internal")
    }
  }

  private func handle(_ body: [String: Any]) throws -> Any {
    guard let workspace else { throw WorkspaceError(code: "internal") }
    let path = body["path"] as? String ?? ""
    let preferencesKey = "preferences:" + workspace.root
    switch body["op"] as? String {
    case "list":
      return try workspace.list()
    case "read":
      let result = try workspace.read(path)
      return ["text": result.text, "revision": result.revision]
    case "save":
      guard let text = body["text"] as? String, let revision = body["revision"] as? String else {
        throw WorkspaceError(code: "invalidContent")
      }
      return ["revision": try workspace.save(path, text: text, revision: revision)]
    case "create":
      guard let text = body["text"] as? String else { throw WorkspaceError(code: "invalidContent") }
      return ["revision": try workspace.create(path, text: text)]
    case "loadPreferences":
      return UserDefaults.standard.string(forKey: preferencesKey) ?? NSNull()
    case "savePreferences":
      guard let value = body["value"] as? String else { throw WorkspaceError(code: "invalidContent") }
      UserDefaults.standard.set(value, forKey: preferencesKey)
      return NSNull()
    default:
      throw WorkspaceError(code: "notFound")
    }
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  private let messages = FileMessageHandler()
  private var window: NSWindow!
  private var webView: WKWebView!

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.mainMenu = makeMenu()
    let configuration = WKWebViewConfiguration()
    configuration.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "outliner")
    configuration.userContentController.addScriptMessageHandler(messages, contentWorld: .page, name: "outliner")
    #if DEBUG
      configuration.userContentController.add(debugScript, name: "debug")
      // `-debugAppearance light|dark` overrides the system appearance.
      if let appearance = UserDefaults.standard.string(forKey: "debugAppearance") {
        NSApp.appearance = NSAppearance(named: appearance == "dark" ? .darkAqua : .aqua)
      }
    #endif
    webView = WKWebView(frame: .zero, configuration: configuration)
    #if DEBUG
      webView.navigationDelegate = debugScript
      debugScript.webView = webView
    #endif
    window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 900, height: 700),
      styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
    window.contentView = webView
    window.setFrameAutosaveName("Main")
    if let folder = UserDefaults.standard.string(forKey: folderKey), open(folder) {
      window.makeKeyAndOrderFront(nil)
    } else {
      chooseFolder(nil)
    }
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

  @objc func chooseFolder(_ sender: Any?) {
    let panel = NSOpenPanel()
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.prompt = "Open"
    // Quit when the first choice is cancelled: there is nothing to show without a folder.
    guard panel.runModal() == .OK, let url = panel.url, open(url.path) else {
      if messages.workspace == nil { NSApp.terminate(nil) }
      return
    }
    UserDefaults.standard.set(url.path, forKey: folderKey)
    window.makeKeyAndOrderFront(nil)
  }

  // Loads the page for `folder`; unsaved input in the previous folder's page is discarded.
  private func open(_ folder: String) -> Bool {
    guard let workspace = try? Workspace(folder: folder) else { return false }
    messages.workspace = workspace
    window.title = FileManager.default.displayName(atPath: workspace.root)
    window.representedURL = URL(fileURLWithPath: workspace.root)
    webView.load(URLRequest(url: URL(string: appOrigin)!))
    return true
  }

  private func makeMenu() -> NSMenu {
    let menu = NSMenu()
    let name = Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as! String
    func submenu(_ title: String, _ items: [NSMenuItem]) {
      let sub = NSMenu(title: title)
      items.forEach(sub.addItem)
      menu.addItem(withTitle: title, action: nil, keyEquivalent: "").submenu = sub
    }
    func item(_ title: String, _ action: Selector, _ key: String, _ modifiers: NSEvent.ModifierFlags = .command) -> NSMenuItem {
      let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
      item.keyEquivalentModifierMask = modifiers
      return item
    }
    submenu(name, [
      item("Hide \(name)", #selector(NSApplication.hide(_:)), "h"),
      .separator(),
      item("Quit \(name)", #selector(NSApplication.terminate(_:)), "q"),
    ])
    submenu("File", [
      item("Open Folder…", #selector(chooseFolder(_:)), "o"),
      item("Close Window", #selector(NSWindow.performClose(_:)), "w"),
    ])
    // Responder-chain actions that WKWebView implements, so the shortcuts work in its fields.
    submenu("Edit", [
      item("Undo", Selector(("undo:")), "z"),
      item("Redo", Selector(("redo:")), "z", [.command, .shift]),
      .separator(),
      item("Cut", #selector(NSText.cut(_:)), "x"),
      item("Copy", #selector(NSText.copy(_:)), "c"),
      item("Paste", #selector(NSText.paste(_:)), "v"),
      item("Select All", #selector(NSText.selectAll(_:)), "a"),
    ])
    return menu
  }

  #if DEBUG
    private let debugScript = DebugScript()
  #endif
}

#if DEBUG
  // Debug builds only (`npm run build:mac -- --debug`): `-debugScript <file>` evaluates that file in the
  // page after each load, so the app can be checked without UI automation or screen recording
  // permissions. The script can call window.webkit.messageHandlers.debug.postMessage with
  // { log: text } to print to stdout, { snapshot: path } to write a PNG of the page,
  // { perform: "copy:" } to send a menu action to the responder chain, or { window: "" } to print
  // the window title and the menus.
  final class DebugScript: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    weak var webView: WKWebView?

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      guard let path = UserDefaults.standard.string(forKey: "debugScript") else { return }
      webView.evaluateJavaScript(try! String(contentsOfFile: path, encoding: .utf8)) { _, error in
        if let error { print("debug script failed:", error) }
      }
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
      let body = message.body as! [String: String]
      if let text = body["log"] { print(text) }
      if let action = body["perform"] { print("perform", action, NSApp.sendAction(Selector(action), to: nil, from: nil)) }
      if body["window"] != nil {
        print("window title:", webView!.window!.title)
        for menu in NSApp.mainMenu!.items {
          print("menu", menu.title, menu.submenu!.items.map { "\($0.title) [\($0.keyEquivalentModifierMask.rawValue):\($0.keyEquivalent)]" })
        }
      }
      if let path = body["snapshot"] {
        webView!.takeSnapshot(with: nil) { image, error in
          let bitmap = NSBitmapImageRep(data: image!.tiffRepresentation!)!
          try! bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
          print("snapshot", path, error.map(String.init(describing:)) ?? "")
        }
      }
      fflush(stdout)
    }
  }
#endif

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
