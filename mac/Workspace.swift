import CryptoKit
import Foundation

// The Swift port of createOutlinerApi in server.mjs for one folder. Keep the checks, revisions and
// error codes in sync with it: the page shows the codes through `server` in src/ui/messages.ts.
// Calls arrive one at a time on the main thread, so unlike server.mjs no save can overlap another.

struct WorkspaceError: Error, Equatable {
  let code: String
}

let maxBytes = 2 * 1024 * 1024

func revisionOf(_ text: String) -> String {
  SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
}

final class Workspace {
  let root: String

  init(folder: String) throws {
    guard let resolved = realPath(folder) else { throw WorkspaceError(code: "folderMissing") }
    root = resolved
  }

  func list() throws -> [String] {
    try filesIn(root, prefix: "").sorted()
  }

  func read(_ relative: String) throws -> (text: String, revision: String) {
    let text = try readText(try markdownFile(relative))
    return (text, revisionOf(text))
  }

  // The check detects existing external edits; uncoordinated writers can still race the final rename.
  func save(_ relative: String, text: String, revision expected: String) throws -> String {
    guard text.utf8.count <= maxBytes else { throw WorkspaceError(code: "invalidContent") }
    let full = try markdownFile(relative)
    guard revisionOf(try readText(full)) == expected else { throw WorkspaceError(code: "externalChange") }
    let mode = try FileManager.default.attributesOfItem(atPath: full)[.posixPermissions] as! NSNumber
    let temporary = full + ".outliner-" + UUID().uuidString.prefix(16).lowercased()
    try writeNew(temporary, text, mode: mode_t(mode.uint16Value))
    defer { unlink(temporary) }
    guard revisionOf(try readText(full)) == expected else { throw WorkspaceError(code: "externalChangeBeforeSave") }
    guard rename(temporary, full) == 0 else { throw posixError() }
    guard revisionOf(try readText(full)) == revisionOf(text) else { throw WorkspaceError(code: "saveRace") }
    return revisionOf(text)
  }

  func create(_ relative: String, text: String) throws -> String {
    guard text.utf8.count <= maxBytes else { throw WorkspaceError(code: "invalidContent") }
    try checkRelative(relative)
    // Lexical like path.resolve: `..` is removed before the folder is resolved.
    let full = URL(fileURLWithPath: root).appendingPathComponent(relative).standardized
    guard let directory = realPath(full.deletingLastPathComponent().path) else {
      throw WorkspaceError(code: "folderMissing")
    }
    guard directory == root || directory.hasPrefix(root + "/") else {
      throw WorkspaceError(code: "createOutsideFolder")
    }
    // O_EXCL fails when anything (including a symlink) already exists at the path.
    do { try writeNew(directory + "/" + full.lastPathComponent, text, mode: 0o644) }
    catch let error as NSError where error.domain == NSPOSIXErrorDomain && error.code == Int(EEXIST) {
      throw WorkspaceError(code: "fileExists")
    }
    return revisionOf(text)
  }

  private func checkRelative(_ relative: String) throws {
    guard relative.hasSuffix(".md"), !relative.contains("\\"), !relative.hasPrefix("/") else {
      throw WorkspaceError(code: "notMarkdown")
    }
  }

  private func markdownFile(_ relative: String) throws -> String {
    try checkRelative(relative)
    guard let full = realPath(root + "/" + relative) else {
      if errno == ENOENT { throw WorkspaceError(code: "fileMissing") }
      throw posixError()
    }
    guard full.hasPrefix(root + "/") else { throw WorkspaceError(code: "outsideWorkspace") }
    var info = stat()
    guard stat(full, &info) == 0 else { throw posixError() }
    guard info.st_mode & S_IFMT == S_IFREG, info.st_size <= maxBytes else {
      throw WorkspaceError(code: "fileTooLarge")
    }
    return full
  }

  private func filesIn(_ directory: String, prefix: String) throws -> [String] {
    var files: [String] = []
    for name in try FileManager.default.contentsOfDirectory(atPath: directory) where !name.hasPrefix(".") {
      // lstat, so symbolic links are skipped like Dirent entries in server.mjs.
      var info = stat()
      guard lstat(directory + "/" + name, &info) == 0 else { throw posixError() }
      if info.st_mode & S_IFMT == S_IFDIR {
        files += try filesIn(directory + "/" + name, prefix: prefix + name + "/")
      } else if info.st_mode & S_IFMT == S_IFREG, name.hasSuffix(".md") {
        files.append(prefix + name)
      }
    }
    return files
  }
}

private func realPath(_ path: String) -> String? {
  guard let resolved = realpath(path, nil) else { return nil }
  defer { free(resolved) }
  return String(cString: resolved)
}

private func readText(_ path: String) throws -> String {
  try String(contentsOfFile: path, encoding: .utf8)
}

private func writeNew(_ path: String, _ text: String, mode: mode_t) throws {
  let descriptor = open(path, O_WRONLY | O_CREAT | O_EXCL, mode)
  guard descriptor >= 0 else { throw posixError() }
  defer { close(descriptor) }
  let data = Data(text.utf8)
  let written = data.withUnsafeBytes { write(descriptor, $0.baseAddress, data.count) }
  guard written == data.count else { throw posixError() }
}

private func posixError() -> NSError {
  NSError(domain: NSPOSIXErrorDomain, code: Int(errno))
}
